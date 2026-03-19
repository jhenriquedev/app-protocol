import {
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { PortalRootComponent } from "./root.component";

bootstrapApplication(PortalRootComponent, {
  providers: [provideBrowserGlobalErrorListeners()],
}).catch((error) => {
  console.error(error);
});
