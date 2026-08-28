# Meeting Draft Autosave and Recovery

MeetOnMemory saves unfinished meeting schedule forms in the browser so accidental refreshes or navigation do not erase user input.

## Storage scope

Draft keys include the authenticated user, selected organization, form mode, and meeting ID for edit mode:

```text
meet-on-memory:meeting-draft:v1:<userId>:<organizationId>:<mode>:<meetingId-or-new>
```

This prevents drafts from being restored for another user, organization, or meeting.

## Saved fields

The schedule form stores serializable values only:

- Meeting information
- Participants
- Agenda items
- Selected template

Browser `File` objects are intentionally not persisted because localStorage cannot safely restore file handles. Users must reattach files after a refresh.

## Recovery behavior

- Changes are saved after a 700 ms debounce.
- Drafts expire after seven days.
- Invalid or unsupported draft data is removed safely.
- A recovery banner asks the user to restore or discard a detected draft.
- Successful meeting creation clears the related draft.
- Edit forms can pass `serverUpdatedAt`; drafts older than current server data are discarded to avoid overwriting newer changes.

## Reusing the hook for edit forms

```js
useScheduleMeeting({
  mode: "edit",
  meetingId,
  serverUpdatedAt: meeting.updatedAt,
});
```

The current repository has a schedule/create form but no full meeting edit form. The hook and key format already support edit-mode integration when such a form is added.

## Personal Notes Draft Recovery

Personal notes also mirror the form draft autosave and recovery pattern:

### Storage scope

The draft key for personal notes is scoped by the authenticated user and the specific meeting:

```text
meet-on-memory:personal-notes-draft:v1:<userId>:<meetingId>
```

### Recovery behavior

- Local changes to personal notes are autosaved to the browser's `localStorage` after editing.
- If a browser crash or page reload occurs before the notes are successfully synced to the server, a **Personal Notes Draft Recovery Banner** is displayed above the notes editor.
- The user can choose to **Restore Draft** (copying the local draft back into the editor) or **Discard** the draft.
- **Server wins when fresher**: If the server note has a newer `updatedAt` timestamp than the local draft's `savedAt` timestamp, the draft is ignored and cleaned up automatically to avoid overwriting newer server data.
- The draft is proactively cleared once the client note is fully synchronized with the server.
