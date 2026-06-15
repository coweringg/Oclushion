import { ErrorHandlerService } from "./error-handler.service";
import { showErrorToast } from "./error-toast";

export function integrateErrorHandler(handler: ErrorHandlerService): () => void {
  return handler.subscribe((event) => {
    switch (event.type) {
      case "error:resolved":
        showErrorToast(event.error, { duration: 6000 });
        break;
      case "error:failed":
        showErrorToast(event.error, { duration: 10000 });
        break;
      case "error:retrying":
        break;
    }
  });
}
