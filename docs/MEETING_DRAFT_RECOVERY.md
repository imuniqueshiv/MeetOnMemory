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
