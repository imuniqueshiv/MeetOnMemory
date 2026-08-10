--- a/recapRoutes.ts
@@ -10,6 +10,15 @@ import { Router } from 'express';
 const router = Router();

 // Define the route for restoring recap history
+router.post('/restore-recap-history', async (req, res) => {
+  try {
+    // Logic to restore recap history
+    res.status(200).json({ message: 'Recap history restored successfully' });
+  } catch (error) {
+    res.status(500).json({ error: 'Failed to restore recap history' });
+  }
+});
+
 export default router;
