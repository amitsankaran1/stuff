/**
 * Two-way sync of file attachments between a Todoist task's comments and a
 * Notion page's Files & media property.
 *
 * Files are identified by name and copied (download + re-upload) because both
 * sides' URLs are temporary/auth-gated. A per-page manifest (a hidden Notion
 * rich_text property) records the filenames confirmed synced as of the last
 * pass; it is what distinguishes "newly added on one side" from "deleted on
 * the other" — the basis for correct, loop-safe deletion sync.
 */

import type { Client } from "@notionhq/client";
import type { Board } from "./config.js";
import type { ParsedTask } from "./notion-tasks.js";
import type { TodoistClient } from "./todoist.js";

/** Notion single-shot upload cap (~20 MB); larger files go multi-part. */
const SINGLE_PART_MAX = 20 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;

export interface AttachmentSummary {
	toNotion: number;
	toTodoist: number;
	deletedNotion: number;
	deletedTodoist: number;
}

interface Manifest {
	v: number;
	files: Array<{ name: string }>;
	/** Intentionally-unsynced files (e.g. too large); excluded from all sets. */
	skipped: Array<{ name: string; reason?: string }>;
}

function parseManifest(raw: string): Manifest {
	if (!raw) return { v: 1, files: [], skipped: [] };
	try {
		const m = JSON.parse(raw);
		return { v: 1, files: m.files ?? [], skipped: m.skipped ?? [] };
	} catch {
		return { v: 1, files: [], skipped: [] };
	}
}

/** Split a string into ≤1900-char rich_text fragments (Notion's item limit). */
function richTextChunks(s: string): Array<{ text: { content: string } }> {
	if (!s) return [];
	const chunks: Array<{ text: { content: string } }> = [];
	for (let i = 0; i < s.length; i += 1900) {
		chunks.push({ text: { content: s.slice(i, i + 1900) } });
	}
	return chunks;
}

/** GET raw bytes with no auth (for Notion's pre-signed file URLs). */
export async function downloadBinary(url: string): Promise<Blob> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`download ${url} failed: ${response.status}`);
	}
	return await response.blob();
}

/** Upload a Blob to Notion, returning a file_upload id to reference. */
export async function uploadToNotion(
	notion: Client,
	filename: string,
	contentType: string | undefined,
	data: Blob,
): Promise<string> {
	const uploads = (notion as any).fileUploads;
	const createArgs: any = { filename };
	if (contentType) createArgs.content_type = contentType;

	if (data.size <= SINGLE_PART_MAX) {
		createArgs.mode = "single_part";
		const up = await uploads.create(createArgs);
		await uploads.send({ file_upload_id: up.id, file: { data, filename } });
		return up.id;
	}

	const parts = Math.ceil(data.size / PART_SIZE);
	createArgs.mode = "multi_part";
	createArgs.number_of_parts = parts;
	const up = await uploads.create(createArgs);
	for (let i = 0; i < parts; i++) {
		const slice = data.slice(i * PART_SIZE, Math.min((i + 1) * PART_SIZE, data.size));
		await uploads.send({
			file_upload_id: up.id,
			part_number: i + 1,
			file: { data: slice, filename },
		});
	}
	await uploads.complete({ file_upload_id: up.id });
	return up.id;
}

/** Build a Notion files-property value from retained files plus new uploads. */
function buildAttachmentsProp(
	retained: ParsedTask["attachments"],
	addUploads: Array<{ id: string; name: string }>,
): any[] {
	return [
		...retained.map((f) =>
			f.kind === "external"
				? { type: "external", name: f.name, external: { url: f.url } }
				: { type: "file", name: f.name, file: { url: f.url } },
		),
		...addUploads.map((u) => ({
			type: "file_upload",
			name: u.name,
			file_upload: { id: u.id },
		})),
	];
}

/**
 * Reconcile the attachment set of one page ⇄ its Todoist task. Idempotent and
 * loop-safe; callable from either webhook or reconcile. Returns action counts.
 */
export async function reconcileAttachments(
	notion: Client,
	todoist: TodoistClient,
	board: Board,
	page: ParsedTask,
	todoistId: string | null,
	apply: boolean,
): Promise<AttachmentSummary> {
	const summary: AttachmentSummary = {
		toNotion: 0,
		toTodoist: 0,
		deletedNotion: 0,
		deletedTodoist: 0,
	};
	if (!board.prop.attachments || !board.prop.syncManifest || !todoistId) {
		return summary;
	}

	const manifest = parseManifest(page.syncManifest);
	const skipped = new Set(manifest.skipped.map((s) => s.name));

	// Current state on each side, keyed by filename, excluding skipped files.
	const comments = await todoist.listComments(todoistId);
	const N = new Map(
		page.attachments.filter((f) => !skipped.has(f.name)).map((f) => [f.name, f]),
	);
	const D = new Map(
		comments
			.filter((c) => c.file_attachment && !skipped.has(c.file_attachment.file_name))
			.map((c) => [
				c.file_attachment!.file_name,
				{
					url: c.file_attachment!.file_url,
					type: c.file_attachment!.file_type,
					commentId: c.id,
				},
			]),
	);
	const M = new Set(manifest.files.map((f) => f.name).filter((n) => !skipped.has(n)));

	const copyToTodoist: string[] = [];
	const copyToNotion: string[] = [];
	const deleteFromNotion: string[] = [];
	const deleteFromTodoist: string[] = [];
	for (const name of new Set([...N.keys(), ...D.keys(), ...M])) {
		const inN = N.has(name);
		const inD = D.has(name);
		const inM = M.has(name);
		if (inN && !inD && !inM) copyToTodoist.push(name);
		else if (!inN && inD && !inM) copyToNotion.push(name);
		else if (inN && !inD && inM) deleteFromNotion.push(name);
		else if (!inN && inD && inM) deleteFromTodoist.push(name);
	}

	if (!apply) {
		summary.toNotion = copyToNotion.length;
		summary.toTodoist = copyToTodoist.length;
		summary.deletedNotion = deleteFromNotion.length;
		summary.deletedTodoist = deleteFromTodoist.length;
		return summary;
	}

	// Names that should be in the manifest after this pass: present on both
	// sides (already, or via a successful copy), plus deletes that FAILED (so
	// they retry next pass rather than flipping to a re-copy).
	const keep = new Set<string>();
	for (const name of N.keys()) if (D.has(name)) keep.add(name);

	// Copies to Notion — upload now; the actual page write is combined below.
	const addUploads: Array<{ id: string; name: string }> = [];
	for (const name of copyToNotion) {
		try {
			const att = D.get(name)!;
			const blob = await todoist.downloadAttachment(att.url);
			const id = await uploadToNotion(notion, name, att.type, blob);
			addUploads.push({ id, name });
			keep.add(name);
			summary.toNotion++;
		} catch (e) {
			console.log(`attachment → Notion failed (${name}): ${e}`);
		}
	}

	// Copies to Todoist — download from Notion (no auth), upload, comment.
	for (const name of copyToTodoist) {
		try {
			const file = N.get(name)!;
			const blob = await downloadBinary(file.url);
			const uploaded = await todoist.uploadFile(name, undefined, blob);
			await todoist.createComment(todoistId, name, uploaded);
			keep.add(name);
			summary.toTodoist++;
		} catch (e) {
			console.log(`attachment → Todoist failed (${name}): ${e}`);
		}
	}

	// Deletes from Todoist — remove the comment carrying the file.
	for (const name of deleteFromTodoist) {
		try {
			await todoist.deleteComment(D.get(name)!.commentId);
			summary.deletedTodoist++;
		} catch (e) {
			console.log(`attachment delete in Todoist failed (${name}): ${e}`);
			keep.add(name); // retry next pass
		}
	}

	// Deletes from Notion are applied by omitting them from the rewritten list.
	const removeNames = new Set(deleteFromNotion);
	summary.deletedNotion = removeNames.size;

	const attachmentsChanged = addUploads.length > 0 || removeNames.size > 0;
	const manifestChanged =
		keep.size !== M.size || [...keep].some((n) => !M.has(n));
	if (!attachmentsChanged && !manifestChanged) return summary;

	// One combined write: files (only if changed) + the new manifest.
	const properties: any = {};
	if (attachmentsChanged) {
		const retained = page.attachments.filter((f) => !removeNames.has(f.name));
		properties[board.prop.attachments] = {
			files: buildAttachmentsProp(retained, addUploads),
		};
	}
	const newManifest: Manifest = {
		v: 1,
		files: [...keep].map((name) => ({ name })),
		skipped: manifest.skipped,
	};
	properties[board.prop.syncManifest] = {
		rich_text: richTextChunks(JSON.stringify(newManifest)),
	};
	await notion.pages.update({ page_id: page.pageId, properties });

	return summary;
}
