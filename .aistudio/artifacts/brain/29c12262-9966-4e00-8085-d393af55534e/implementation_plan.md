# Implementation Plan - Profil Page Refined Redesign

## User Requests
1. **Container Styling**: Match the profile main container (photo, name, jabatan, NIP) **exactly** to the royal blue gradient container style on the dashboard/home page.
2. **Replace Info Section with Digital Signature**: Remove the account/task info section and replace it entirely with the teacher's digital signature ("Paraf Digital Guru").
3. **Compact Plain Text "kembali"**: Render the return button as plain text `"kembali"` without any arrow symbol and without any button wrapper box.
4. **Proportional Font Sizing**: Keep font sizes compact and proportional.
5. **Fullscreen Fit without Vertical Scroll**: Ensure the page fits viewport height without vertical scrolling (`h-full min-h-0 overflow-hidden flex flex-col`).
6. **Background**: Match dashboard's Soft UI Modern background (`bg-[#EBF0F8]`).

## Proposed Changes

### `/src/components/Profil.tsx`
- **Main Container**: Use the exact dashboard royal blue gradient card style (`from-[#1A56DB] via-[#2167F3] to-[#1244A8]`) containing the circular photo with camera badge, name, jabatan, and NIP.
- **Digital Signature Section**: Render the Paraf Digital Guru section cleanly below the main header card.
- **Plain Text Return**: Render `"kembali"` as a clean clickable text link at the bottom (no box wrapper, no arrow).
- **Edit Modal**: Keep the floating edit modal intact (allowing editing of name, titles, jabatan, atasan, username, password, paraf; NIP is read-only).
- **Layout**: Use `h-full min-h-0 overflow-hidden flex flex-col justify-between` to guarantee no vertical scrolling.

## Verification Plan
- Compile applet with `compile_applet`.
- Lint with `lint_applet`.
