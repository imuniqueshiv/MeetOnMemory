--- a/src/socket.ts
@@ -10,7 +10,7 @@
     this.socket = io.connect(this.url);
     this.socket.on('connect', () => {
       console.log('Connected to server');
-      this.registerEvents();
+      this.registerSocketEvents();
     });
   }
 
@@ -25,6 +25,10 @@ class SocketService {
     this.socket.emit(event, data);
   }
 
+  private registerSocketEvents(): void {
+    // Re-establish event listeners here
+    this.socket.on('eventName', this.handleEvent.bind(this));
+  }
+
   private handleEvent(data: any): void {
     console.log('Received event:', data);
   }
