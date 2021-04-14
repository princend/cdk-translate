/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { NgZone } from '@angular/core';
import { InteractivityChecker } from '../interactivity-checker/interactivity-checker';
import { FocusTrap } from './focus-trap';
import { FocusTrapManager, ManagedFocusTrap } from './focus-trap-manager';
import { FocusTrapInertStrategy } from './focus-trap-inert-strategy';
import { ConfigurableFocusTrapConfig } from './configurable-focus-trap-config';

/**
 * Class that allows for trapping focus within a DOM element.
 *
 * This class uses a strategy pattern that determines how it traps focus.
 * See FocusTrapInertStrategy.
 * 允許在DOM元素內捕獲焦點的類。
 * 此類使用一種策略模式來確定如何捕獲焦點。
 * 請參閱FocusTrapInertStrategy
 */
export class ConfigurableFocusTrap extends FocusTrap implements ManagedFocusTrap {
  /** Whether the FocusTrap is enabled. */
  // 是否啟用了FocusTrap。
  get enabled(): boolean { return this._enabled; }
  set enabled(value: boolean) {
    this._enabled = value;
    if (this._enabled) {
      this._focusTrapManager.register(this);
    } else {
      this._focusTrapManager.deregister(this);
    }
  }

  constructor(
    _element: HTMLElement,
    _checker: InteractivityChecker,
    _ngZone: NgZone,
    _document: Document,
    private _focusTrapManager: FocusTrapManager,
    private _inertStrategy: FocusTrapInertStrategy,
    config: ConfigurableFocusTrapConfig) {
    super(_element, _checker, _ngZone, _document, config.defer);
    this._focusTrapManager.register(this);
  }

  /** Notifies the FocusTrapManager that this FocusTrap will be destroyed. */
  // 通知FocusTrapManager此FocusTrap將被銷毀。
  destroy() {
    this._focusTrapManager.deregister(this);
    super.destroy();
  }

  /** @docs-private Implemented as part of ManagedFocusTrap. */
  // @ docs-private作為ManagedFocusTrap的一部分實現
  _enable() {
    this._inertStrategy.preventFocus(this);
    this.toggleAnchors(true);
  }

  /** @docs-private Implemented as part of ManagedFocusTrap. */
  // @ docs-private作為ManagedFocusTrap的一部分實現
  _disable() {
    this._inertStrategy.allowFocus(this);
    this.toggleAnchors(false);
  }
}
