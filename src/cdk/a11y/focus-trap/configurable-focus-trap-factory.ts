/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { DOCUMENT } from '@angular/common';
import {
  Inject,
  Injectable,
  Optional,
  NgZone,
} from '@angular/core';
import { InteractivityChecker } from '../interactivity-checker/interactivity-checker';
import { ConfigurableFocusTrap } from './configurable-focus-trap';
import { ConfigurableFocusTrapConfig } from './configurable-focus-trap-config';
import { FOCUS_TRAP_INERT_STRATEGY, FocusTrapInertStrategy } from './focus-trap-inert-strategy';
import { EventListenerFocusTrapInertStrategy } from './event-listener-inert-strategy';
import { FocusTrapManager } from './focus-trap-manager';

/** Factory that allows easy instantiation of configurable focus traps. */
// 工廠允許輕鬆實例化可配置的焦點陷阱。
@Injectable({ providedIn: 'root' })
export class ConfigurableFocusTrapFactory {
  private _document: Document;
  private _inertStrategy: FocusTrapInertStrategy;

  constructor(
    private _checker: InteractivityChecker,
    private _ngZone: NgZone,
    private _focusTrapManager: FocusTrapManager,
    @Inject(DOCUMENT) _document: any,
    @Optional() @Inject(FOCUS_TRAP_INERT_STRATEGY) _inertStrategy?: FocusTrapInertStrategy) {

    this._document = _document;
    // TODO split up the strategies into different modules, similar to DateAdapter.
    // 將策略分成不同的模塊，類似於DateAdapter。
    // inert 惰性
    this._inertStrategy = _inertStrategy || new EventListenerFocusTrapInertStrategy();
  }

  /**
   * Creates a focus-trapped region around the given element.
   * @param element The element around which focus will be trapped.
   * @param config The focus trap configuration.
   * @returns The created focus trap instance.
   * 在給定元素周圍創建一個焦點捕獲區域。
   * @param元素將圍繞其捕獲焦點的元素。
   * @param config焦點陷阱配置。
   * @returns創建的焦點陷阱實例。
   */
  create(element: HTMLElement, config?: ConfigurableFocusTrapConfig): ConfigurableFocusTrap;

  /**
   * @deprecated Pass a config object instead of the `deferCaptureElements` flag.
   * @breaking-change 11.0.0
   * @deprecated傳遞一個配置對象而不是`deferCaptureElements`標誌。
   * @ breaking-change 11.0.0
   */
  create(element: HTMLElement, deferCaptureElements: boolean): ConfigurableFocusTrap;

  create(element: HTMLElement, config: ConfigurableFocusTrapConfig | boolean =
    new ConfigurableFocusTrapConfig()): ConfigurableFocusTrap {
    let configObject: ConfigurableFocusTrapConfig;
    if (typeof config === 'boolean') {
      configObject = new ConfigurableFocusTrapConfig();
      configObject.defer = config;
    } else {
      configObject = config;
    }
    return new ConfigurableFocusTrap(
      element, this._checker, this._ngZone, this._document, this._focusTrapManager,
      this._inertStrategy, configObject);
  }
}
