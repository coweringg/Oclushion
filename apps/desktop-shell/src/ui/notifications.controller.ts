import { BaseController, type ControllerContext } from "./controller";
import { NotificationsRenderer, type NotificationsState } from "./renderers/notifications.renderer";
import type { OclushionOSService } from "../os/os.service";

export class NotificationsController extends BaseController {
  private readonly renderer = new NotificationsRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  
  private currentState: NotificationsState = {
    notifications: [],
    settings: { muteLow: false, muteMedium: false, adminWatchMode: true },
    isOpen: false,
  };

  public constructor(
    context: ControllerContext,
    private readonly osService: OclushionOSService,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document 
      ? this.context.root.getElementById("ocl-notifications-mount") 
      : this.context.root.querySelector("#ocl-notifications-mount");

    if (!this.container) return;

    this.attachEvents();
    
    this.unsubscribe = this.osService.subscribe((snapshot) => {
      this.currentState.notifications = snapshot.notifications;
      this.currentState.settings = snapshot.notificationSettings;
      this.render();
    });
  }

  public override destroy(): void {
    super.destroy();
    this.unsubscribe?.();
  }

  private attachEvents(): void {
    this.listen("#notif-bell-trigger", "click", () => {
      this.currentState.isOpen = !this.currentState.isOpen;
      this.render();
    });

    this.listen(".ocl-notif-mute-btn", "click", (e, element) => {
      const severity = element.getAttribute("data-severity");
      if (severity === "low") {
        this.osService.updateNotificationSettings({ muteLow: !this.currentState.settings.muteLow });
      } else if (severity === "medium") {
        this.osService.updateNotificationSettings({ muteMedium: !this.currentState.settings.muteMedium });
      }
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.currentState);
    }
  }
}
