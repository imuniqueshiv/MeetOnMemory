import eventBus from "./eventBus.js";
import AutomationRule from "../models/automationRuleModel.js";
import Organization from "../models/organizationModel.js";
import {
  postBlockMessage,
  buildMeetingCreatedBlocks,
  buildMoMSummaryBlocks,
} from "./slackService.js";
import { webhookQueue } from "./webhookDispatcherService.js";
// email and tags can be done via other existing services

/**
 * Evaluates rules against an event and its data payload.
 */
export const evaluateRules = async (eventType, payload) => {
  try {
    // Determine the organization ID based on event type payload structure
    let orgId = null;
    let meetingData = null;

    if (eventType === "meeting.created" && payload.meeting) {
      orgId = payload.meeting.organization || payload.meeting.organizationId;
      meetingData = payload.meeting;
    } else if (eventType === "mom.generated") {
      orgId = payload.organization || payload.organizationId;
      meetingData = payload;
    } else if (eventType === "actionItem.completed") {
      orgId = payload.organization || payload.organizationId;
    } else if (eventType === "export.ready") {
      orgId = payload.organization || payload.organizationId;
    }

    if (!orgId) {
      // If we can't extract orgId, we cannot evaluate org-level rules
      return;
    }

    const rules = await AutomationRule.find({
      organization: orgId,
      enabled: true,
      "trigger.event": eventType,
    });

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      // Evaluate conditions
      let match = true;
      if (rule.trigger.filters) {
        const filters = rule.trigger.filters;
        if (
          filters.meetingType &&
          meetingData?.meetingType !== filters.meetingType
        ) {
          match = false;
        }
        if (filters.minActionItems) {
          const actionItems =
            meetingData?.structuredMoM?.actionItems ||
            meetingData?.structuredMoM?.action_items ||
            [];
          if (actionItems.length < filters.minActionItems) {
            match = false;
          }
        }
        if (filters.sentimentThreshold && meetingData?.sentiment) {
          if (meetingData.sentiment > filters.sentimentThreshold) {
            match = false;
          }
        }
      }

      if (match) {
        await executeActions(rule, payload, meetingData);
        rule.executionCount += 1;
        rule.lastExecutedAt = new Date();
        await rule.save();
      }
    }
  } catch (error) {
    console.error(
      `Error in automation rule evaluation for event ${eventType}:`,
      error,
    );
  }
};

const executeActions = async (rule, payload, meetingData) => {
  const org = await Organization.findById(rule.organization).select(
    "+slackBotToken",
  );

  for (const action of rule.actions) {
    try {
      if (action.type === "slack") {
        if (org && org.slackBotToken && action.config.channelId) {
          let blocks = [];
          if (rule.trigger.event === "meeting.created" && meetingData) {
            blocks = buildMeetingCreatedBlocks(
              meetingData,
              "MeetOnMemory Automation",
            );
          } else if (rule.trigger.event === "mom.generated" && meetingData) {
            blocks = buildMoMSummaryBlocks(meetingData);
          } else {
            blocks = [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Automation Rule Triggered:*\nRule: ${rule.name}\nEvent: ${rule.trigger.event}`,
                },
              },
            ];
          }
          await postBlockMessage(
            org.slackBotToken,
            action.config.channelId,
            blocks,
            "Automation Rule Triggered",
          );
        }
      } else if (action.type === "webhook") {
        if (action.config.webhookId) {
          if (webhookQueue.isActive) {
            await webhookQueue.add("dispatch-webhook", {
              webhookId: action.config.webhookId,
              payload: {
                event: rule.trigger.event,
                ruleName: rule.name,
                data: payload,
              },
            });
          }
        }
      }
      // Add other integrations like email or tags as needed
    } catch (err) {
      console.error(
        `Failed to execute action ${action.type} for rule ${rule._id}:`,
        err,
      );
    }
  }
};

// Register EventBus Listeners
eventBus.on("meeting.created", (payload) =>
  evaluateRules("meeting.created", payload),
);
eventBus.on("mom.generated", (payload) =>
  evaluateRules("mom.generated", payload),
);
eventBus.on("actionItem.completed", (payload) =>
  evaluateRules("actionItem.completed", payload),
);
eventBus.on("export.ready", (payload) =>
  evaluateRules("export.ready", payload),
);
