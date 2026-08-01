import { request, uploadFile } from "./core/client";
import { authApi } from "./auth";
import { usersApi } from "./users";
import { productsApi } from "./products";
import { articlesApi } from "./articles";
import { messagesApi } from "./messages";
import { creaturesApi, petItemsApi } from "./creatures";
import { transactionsApi } from "./transactions";
import { postsApi } from "./posts";
import { notificationsApi } from "./notifications";
import { forumApi } from "./forum";
import { friendRequestsApi } from "./friendRequests";
import { uploadApi } from "./upload";
import { supportApi } from "./support";
import {
  enumTypesApi,
  featureFlagsApi,
} from "./admin/settings";
import { auditLogsApi } from "./admin/auditLogs";
import { dashboardApi } from "./admin/dashboard";

export const api = {
  ...authApi,
  ...usersApi,
  ...productsApi,
  ...articlesApi,
  ...messagesApi,
  ...creaturesApi,
  ...petItemsApi,
  ...transactionsApi,
  ...postsApi,
  ...notificationsApi,
  ...forumApi,
  ...friendRequestsApi,
  ...uploadApi,
  ...supportApi,
  ...enumTypesApi,
  ...featureFlagsApi,
  ...auditLogsApi,
  ...dashboardApi,
};

export { request, uploadFile };
export * from "./core";
export * from "./auth";
export * from "./users";
export * from "./products";
export * from "./articles";
export * from "./messages";
export * from "./creatures";
export * from "./transactions";
export * from "./posts";
export * from "./notifications";
export * from "./forum";
export * from "./friendRequests";
export * from "./upload";
export * from "./support";
export * from "./admin";
