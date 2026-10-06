/**
 * Kept for import stability.
 *
 * The file chip moved to `components/shared/file-chip.tsx` because chat needs
 * it too, and a chat component reaching into `components/notes/` was the wrong
 * dependency direction. New code should import from the shared path.
 */
export { FileChip, type AttachedFile } from "@/components/shared/file-chip";
