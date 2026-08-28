import GithubIntegration from "./githubIntegrationModel.js";
import NotionIntegration from "./notionIntegrationModel.js";
import CalendarConnection from "./calendarConnectionModel.js";

export const GitHubConfig = GithubIntegration;
export const NotionConfig = NotionIntegration;
export const CalendarConfig = CalendarConnection;
export const SlackConfig = null;
export const JiraConfig = null;

export default {
  GitHubConfig,
  NotionConfig,
  CalendarConfig,
  SlackConfig,
  JiraConfig,
};
