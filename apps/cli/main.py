--- a/apps/cli/main.py
@@ -100,6 +100,10 @@ def vote(command):
     option_id = command.option_id
     user_id = get_current_user_id()
 
+    if has_voted(user_id, option_id):
+        print("You have already voted for this option.")
+        return
+
     cast_vote(option_id, user_id)
     print("Vote cast successfully.")
