/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Platform} from '@angular/cdk/platform';
import {DOCUMENT} from '@angular/common';
import {Inject, Injectable} from '@angular/core';


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
@Injectable({providedIn: 'root'})
export class HighContrastModeDetector {
  private _document: Document;

  constructor(private _platform: Platform, @Inject(DOCUMENT) document: any) {
    this._document = document;
  }

  /** Gets the current high-contrast-mode for the page. */
  getHighContrastMode(): HighContrastMode {
    if (!this._platform.isBrowser) {
      return HighContrastMode.NONE;
    }

    // Create a test element with an arbitrary background-color that is neither black nor
    // white; high-contrast mode will coerce the color to either black or white. Also ensure that
    // appending the test element to the DOM does not affect layout by absolutely positioning it
    const testElement = this._document.createElement('div');
    testElement.style.backgroundColor = 'rgb(1,2,3)';
    testElement.style.position = 'absolute';
    this._document.body.appendChild(testElement);

    // Get the computed style for the background color, collapsing spaces to normalize between
    // browsers. Once we get this color, we no longer need the test element. Access the `window`
    // via the document so we can fake it in tests. Note that we have extra null checks, because
    // this logic will likely run during app bootstrap and throwing can break the entire app.
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
  _applyBodyHighContrastModeCssClasses(): void {
    if (this._platform.isBrowser && this._document.body) {
      const bodyClasses = this._document.body.classList;
      // IE11 doesn't support `classList` operations with multiple arguments
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
