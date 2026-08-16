export const transformMoMToNotionBlocks = (meetingTitle, summary, actionItems) => {
  const blocks = [];

  // Title / Heading
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "Meeting Summary" } }],
    },
  });

  // Callout for Summary
  blocks.push({
    object: "block",
    type: "callout",
    callout: {
      rich_text: [{ type: "text", text: { content: summary || "No summary provided." } }],
      icon: { emoji: "📝" },
    },
  });

  // Action Items
  if (actionItems && actionItems.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Action Items" } }],
      },
    });

    for (const item of actionItems) {
      blocks.push({
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: item.text || item } }],
          checked: false,
        },
      });
    }
  }

  return blocks;
};

export const createNotionProperties = (meetingTitle) => {
  return {
    "Name": {
      title: [
        {
          text: {
            content: meetingTitle || "Untitled Meeting",
          },
        },
      ],
    },
  };
};
