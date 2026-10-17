# Course document and screenshot previews

PDF course links open `app/pages/pdf-reader.html?c=<courseId>&doc=<documentIndex>` in the same tab, preserving the existing sessionStorage login. The reader resolves the document from the authenticated course data rather than accepting a raw file URL in its query string. Legacy `/assets/docs/` paths resolve to the existing Tencent CloudBase static host; external non-PDF documents keep their links.

PDF.js 6.4.299 provides continuous page rendering, selectable text, search, page navigation, zoom and rotation. Last page is saved locally for each account/course/document. This is a reading convenience, not a course-completion record or cross-device progress sync. Protected courses retain their existing access gate. The reader has no download button. Encrypted PDFs ask the user to contact the administrator for a readable version.

Viewer.js 1.15.2 loads only when a screenshot is opened. `openShotViewer` obtains new signed image URLs through the existing `shotSign` action before showing a gallery. A failed authorization never falls back to a stale cached URL in live mode. Closing a gallery destroys it and returns focus; Escape closes the image viewer while retaining any underlying review dialog.

Libraries, worker, fonts, character maps and decoding resources are vendored under `app/assets/vendor` with licenses. Update the matching PDF.js assets together. No runtime public CDN dependency is required.

Validation: `node --test tests/*.test.cjs`. Browser checks cover a real course PDF, Chinese search, page navigation, zoom, page restoration, login gating, and a two-image gallery with rotation and switching. No production backend code, storage ACLs or learning records are changed by this integration.
