--- a/fetch.ts
@@ -1,5 +1,7 @@
 import { withSession } from 'clerk';

-export const fetchData = async (url: string) => {
+const fetchWrapper = withSession(async (url: string) => {
+  try {
     const response = await fetch(url);
     if (!response.ok) {
       throw new Error(`HTTP error! status: ${response.status}`);
@@ -7,5 +9,8 @@
       return await response.json();
     }
   } catch (error) {
-    console.error(error);
-    return null;
+      console.error(error);
+      return null;
+  }
+});
+
+export const fetchData = async (url: string) => fetchWrapper(url);
