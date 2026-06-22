import { AppModel } from "./state-manager";
import { createInitialAppState } from "./state-manager";

let _model: AppModel | null = null;

export function getModel(): AppModel {
  if (!_model) {
    _model = new AppModel(createInitialAppState());
  }
  return _model;
}

export function setModel(model: AppModel): void {
  _model = model;
}
