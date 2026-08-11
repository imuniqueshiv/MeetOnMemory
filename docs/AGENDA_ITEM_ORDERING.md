# Persistent Agenda Item Ordering

Meeting agenda items now carry a zero-based `position` value. The server normalizes all incoming arrays before persistence, so missing, duplicate, negative, or malformed positions cannot create unstable ordering.

## Accessibility

The scheduling form supports:

- Move Up and Move Down buttons for keyboard users
- Disabled boundary controls for the first and last items
- An `aria-live` announcement after every move
- Pointer drag-and-drop as an optional enhancement

## Backward compatibility

Meetings created before this feature may not have positions. They are interpreted in their existing array order and normalized the next time the meeting is saved.

## Data flow

The normalized array is stored in MongoDB and is returned in that order to meeting details, AI summarization, shared links, and export flows. Consumers should use the stored array order or sort by `position` when working with untrusted external data.
