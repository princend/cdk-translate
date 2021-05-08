/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { FocusTrapInertStrategy } from './focus-trap-inert-strategy';
import { ConfigurableFocusTrap } from './configurable-focus-trap';
import { closest } from './polyfill';

/**
 * Lightweight FocusTrapInertStrategy that adds a document focus event
 * listener to redirect focus back inside the FocusTrap.
 * 輕量級FocusTrapInertStrategy，可添加文檔焦點事件
 * 偵聽器將焦點重定向回FocusTrap內部。
 */
export class EventListenerFocusTrapInertStrategy implements FocusTrapInertStrategy {
  /** Focus event handler. */
  // 焦點事件處理程序。
  private _listener: ((e: FocusEvent) => void) | null = null;

  /** Adds a document event listener that keeps focus inside the FocusTrap. */
  // 添加一個文檔事件偵聽器，使焦點保持在FocusTrap內部。
  preventFocus(focusTrap: ConfigurableFocusTrap): void {
    // Ensure there's only one listener per document
    // 確保每個document只有一個偵聽器
    if (this._listener) {
      focusTrap._document.removeEventListener('focus', this._listener!, true);
    }

    this._listener = (e: FocusEvent) => this._trapFocus(focusTrap, e);
    focusTrap._ngZone.runOutsideAngular(() => {
      focusTrap._document.addEventListener('focus', this._listener!, true);
    });
  }

  /** Removes the event listener added in preventFocus. */
  // 刪除在preventFocus中添加的事件偵聽器。
  allowFocus(focusTrap: ConfigurableFocusTrap): void {
    if (!this._listener) {
      return;
    }
    focusTrap._document.removeEventListener('focus', this._listener!, true);
    this._listener = null;
  }

  /**
   * Refocuses the first element in the FocusTrap if the focus event target was outside
   * the FocusTrap.
   *
   * This is an event listener callback. The event listener is added in runOutsideAngular,
   * so all this code runs outside Angular as well.
   * 如果焦點事件目標不在焦點上，則重新聚焦FocusTrap中的第一個元素
   * FocusTrap。
   *
   * 這是一個事件偵聽器回調(callback)。將事件偵聽器添加到runOutsideAngular中，
   * 因此，所有這些代碼也都在Angular之外運行。
   */
  private _trapFocus(focusTrap: ConfigurableFocusTrap, event: FocusEvent) {
    const target = event.target as HTMLElement;
    const focusTrapRoot = focusTrap._element;

    // Don't refocus if target was in an overlay, because the overlay might be associated
    // with an element inside the FocusTrap, ex. mat-select.
    // 如果目標位於疊加層中，請勿重新聚焦，因為該疊加層可能已關聯
    // 例如在FocusTrap中包含一個元素。mat-select。
    if (!focusTrapRoot.contains(target) && closest(target, 'div.cdk-overlay-pane') === null) {
      // Some legacy FocusTrap usages have logic that focuses some element on the page
      // just before FocusTrap is destroyed. For backwards compatibility, wait
      // to be sure FocusTrap is still enabled before refocusing.
      //一些傳統的FocusTrap用法具有使頁面上的某些元素集中的邏輯
      //就在FocusTrap被銷毀之前。為了向後兼容，
      //請等待以確保在重新對焦之前仍啟用FocusTrap。
      setTimeout(() => {
        // Check whether focus wasn't put back into the focus trap while the timeout was pending.
        // 檢查超時pending期間是否沒有將焦點放回焦點陷阱。
        if (focusTrap.enabled && !focusTrapRoot.contains(focusTrap._document.activeElement)) {
          focusTrap.focusFirstTabbableElement();
        }
      });
    }
  }
}
