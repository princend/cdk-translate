/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Platform } from '@angular/cdk/platform';
import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';


/** Set of possible high-contrast mode backgrounds. */
//一組可能的高對比度模式背景。
export const enum HighContrastMode {
  NONE,
  BLACK_ON_WHITE,
  WHITE_ON_BLACK,
}

/** CSS class applied to the document body when in black-on-white high-contrast mode. */
// 在黑白高對比度模式下將CSS類應用於文檔主體。
export const BLACK_ON_WHITE_CSS_CLASS = 'cdk-high-contrast-black-on-white';

/** CSS class applied to the document body when in white-on-black high-contrast mode. */
// 處於黑底白高對比度模式時，CSS類應用於文檔主體。
export const WHITE_ON_BLACK_CSS_CLASS = 'cdk-high-contrast-white-on-black';

/** CSS class applied to the document body when in high-contrast mode. */
// CSS類在高對比度模式下應用於文檔主體。 
export const HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS = 'cdk-high-contrast-active';

/**
 * Service to determine whether the browser is currently in a high-contrast-mode environment.
 *
 * Microsoft Windows supports an accessibility feature called "High Contrast Mode". This mode
 * changes the appearance of all applications, including web applications, to dramatically increase
 * contrast.
 *
 * IE, Edge, and Firefox currently support this mode. Chrome does not support Windows High Contrast
 * Mode. This service does not detect high-contrast mode as added by the Chrome "High Contrast"
 * browser extension.
 * 
 * 確定瀏覽器當前是否處於高對比度模式環境中的服務。
 *
 * Microsoft Windows支持一種稱為“高對比度模式”的可訪問性功能。這個模式
 * 更改所有應用程序（包括Web應用程序）的外觀，以顯著增加
 * 對比。
 *
 * IE，Edge和Firefox當前支持此模式。 Chrome瀏覽器不支持Windows高對比度
 * 模式。此服務無法檢測到由Chrome“高對比度”添加的高對比度模式
 * 瀏覽器擴展。
 */
@Injectable({ providedIn: 'root' })
export class HighContrastModeDetector {
  private _document: Document;

  constructor(private _platform: Platform, @Inject(DOCUMENT) document: any) {
    this._document = document;
  }

  /** Gets the current high-contrast-mode for the page. */
  // 獲取頁面的當前高對比度模式。
  getHighContrastMode(): HighContrastMode {
    if (!this._platform.isBrowser) {
      return HighContrastMode.NONE;
    }

    // Create a test element with an arbitrary background-color that is neither black nor
    // white; high-contrast mode will coerce the color to either black or white. Also ensure that
    // appending the test element to the DOM does not affect layout by absolutely positioning it
    // 創建一個具有任意背景色（既不是黑色也不是黑色）的測試元素
    // 白色的;高對比度模式會將顏色強制為黑色或白色。同時確保
    // 將測試元素附加到DOM不會通過絕對定位來影響佈局
    const testElement = this._document.createElement('div');
    testElement.style.backgroundColor = 'rgb(1,2,3)';
    testElement.style.position = 'absolute';
    this._document.body.appendChild(testElement);

    // Get the computed style for the background color, collapsing spaces to normalize between
    // browsers. Once we get this color, we no longer need the test element. Access the `window`
    // via the document so we can fake it in tests. Note that we have extra null checks, because
    // this logic will likely run during app bootstrap and throwing can break the entire app.
    // 獲取背景顏色的計算樣式，收合空格以在之間進行正規化
    // 瀏覽器。一旦獲得這種顏色，就不再需要測試元素。進入窗口
    // 通過文檔，以便我們可以在測試中進行偽造。請注意，我們還有額外的null檢查，因為
    // 此邏輯可能會在應用程序引導期間運行，並且拋出可能會破壞整個應用程序。
    const documentWindow = this._document.defaultView || window;
    const computedStyle = (documentWindow && documentWindow.getComputedStyle) ?
      documentWindow.getComputedStyle(testElement) : null;
    const computedColor =
      (computedStyle && computedStyle.backgroundColor || '').replace(/ /g, '');
    this._document.body.removeChild(testElement);

    switch (computedColor) {
      case 'rgb(0,0,0)': return HighContrastMode.WHITE_ON_BLACK;
      case 'rgb(255,255,255)': return HighContrastMode.BLACK_ON_WHITE;
    }
    return HighContrastMode.NONE;
  }

  /** Applies CSS classes indicating high-contrast mode to document body (browser-only). */
  // 將指示高對比度模式的CSS類應用於文檔正文（僅瀏覽器）。
  _applyBodyHighContrastModeCssClasses(): void {
    if (this._platform.isBrowser && this._document.body) {
      const bodyClasses = this._document.body.classList;
      // IE11 doesn't support `classList` operations with multiple arguments
      // IE11不支持帶有多個參數的`classList`操作
      bodyClasses.remove(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS);
      bodyClasses.remove(BLACK_ON_WHITE_CSS_CLASS);
      bodyClasses.remove(WHITE_ON_BLACK_CSS_CLASS);

      const mode = this.getHighContrastMode();
      if (mode === HighContrastMode.BLACK_ON_WHITE) {
        bodyClasses.add(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS);
        bodyClasses.add(BLACK_ON_WHITE_CSS_CLASS);
      } else if (mode === HighContrastMode.WHITE_ON_BLACK) {
        bodyClasses.add(HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS);
        bodyClasses.add(WHITE_ON_BLACK_CSS_CLASS);
      }
    }
  }
}
