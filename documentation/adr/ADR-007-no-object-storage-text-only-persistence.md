# ADR-007: No Object Storage — Text-Only File Persistence

**Date:** 2026-03-20 14:11:32  
**Status:** Accepted

---

## Context

The system handles resume files that are either uploaded directly by end users or downloaded on-demand from third-party sources (Google Drive, Google Sheets). Each resume is processed to extract raw and structured text content, which is then stored in Firestore and indexed for semantic search.

A naive implementation would persist the original file binaries (PDFs, DOCX files, scanned images) in an object storage bucket (e.g., Google Cloud Storage) so they could be served back to users on demand. However, this introduces several concerns:

- **Cost:** Object storage billing scales with both stored bytes and egress traffic. Accumulating binary resume files over time creates a growing storage cost with no corresponding system benefit, since the system only operates on extracted text.
- **Security posture:** Binary files frequently contain sensitive PII embedded in metadata, fonts, and binary payloads that are difficult to audit or redact. Retaining these files increases the attack surface.
- **Data protection compliance:** Regulations such as GDPR grant individuals the right to erasure ("right to be forgotten"). Deleting a structured Firestore document is straightforward and atomic; hunting down and purging binary blobs from object storage, cache layers, and CDN edges is substantially more complex.
- **Operational complexity:** Introducing a Cloud Storage bucket adds another GCP resource to provision, secure, monitor, and back up.

The system already has all the information it needs to reconstruct a formatted resume document: structured JSON fields extracted by the AI Worker, stored in Firestore. Files downloaded transiently from third-party sources are only needed for the duration of text extraction.

## Decision

The system does **not** persist original file binaries in any object storage service. Instead:

1. **Database-only text persistence:** Resume content is stored exclusively as raw text and structured JSON in Firestore. Binary files are never written to Cloud Storage or any equivalent blob store.
2. **Transient third-party downloads:** When the Ingestor downloads a resume file from Google Drive or Google Sheets, the binary is held only in memory (or a local temp file) for the duration of text extraction, then discarded. It is never persisted beyond the request/processing lifecycle.
3. **Immediate discard of user-uploaded files:** When an end user uploads a document (e.g., for OCR via the Document Reader), the service extracts the text content and returns or forwards it. The original binary is discarded immediately after processing and is never written to durable storage.
4. **On-the-fly file generation:** When a user requests a downloadable resume document, the File Generator service constructs the file at request time from the structured Firestore data. The output template is either a default markup-language template committed to the codebase or a user-supplied template fetched from a third-party source (e.g., a Google Drive document). The generated file is streamed directly to the caller and is not cached or stored.

## Alternatives Considered

**Store all uploaded and downloaded files in Cloud Storage:**  
Provides exact fidelity — the original file is always retrievable. Rejected because it introduces ongoing storage and egress costs, expands the PII attack surface, and complicates right-to-erasure compliance. At the target scale, the cost savings and compliance simplification of the text-only approach outweigh the loss of binary fidelity.

**Store only user-uploaded files; discard third-party downloads:**  
A partial approach that retains uploaded originals for re-download while still discarding transiently fetched files. Rejected because it still incurs object storage costs and compliance complexity for user-uploaded files, without a clear product benefit — the template-based generation path already satisfies the resume download use case.

**Cache generated files in Cloud Storage with a TTL:**  
Generated documents could be written to Cloud Storage and served from there, with objects expiring after a short TTL to control costs. Rejected because it adds operational complexity (TTL policies, cache invalidation on resume updates) and reintroduces transient PII storage in Cloud Storage, without meaningfully improving user experience given that generation is fast.

## Consequences

- **Easier:** No Cloud Storage bucket to provision, secure, monitor, or pay for at baseline scale.
- **Easier:** Right-to-erasure requests are fulfilled by deleting a single Firestore document; no binary blobs need to be located and purged from secondary stores.
- **Easier:** PII exposure surface is limited to Firestore, which is already protected by Cloud KMS encryption and fine-grained IAM. There is no additional storage layer to audit.
- **Easier:** Ingestor and Document Reader services are stateless with respect to file storage — they receive, process, and discard, with no dependency on an external storage API.
- **Harder:** Users cannot retrieve their original uploaded file from the system. If the original is lost, the only recovery path is template-based regeneration, which may not reproduce the original formatting or all visual content (e.g., embedded images, custom fonts).
- **Harder:** The File Generator must produce a high-quality output from structured data alone. Resume templates must be carefully designed to ensure the generated document is professionally usable.
- **Harder:** If a processing error occurs during ingestion, the source file is gone. Re-ingestion requires the user or recruiter to re-upload or re-share the original document from its third-party source.
- **Follow-on:** The File Generator must support at least one default template that produces a complete, well-formatted resume document from the structured JSON fields stored by the AI Worker. See [Data Flow](../data-flow.md#file-generation-flow).