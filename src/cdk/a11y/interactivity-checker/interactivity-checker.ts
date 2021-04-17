/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Platform } from '@angular/cdk/platform';
import { Injectable } from '@angular/core';

/**
 * Configuration for the isFocusable method.
 * isFocusable方法的配置。
 */
export class IsFocusableConfig {
  /**
   * Whether to count an element as focusable even if it is not currently visible.
   * 是否將一個元素視為可聚焦元素，即使該元素當前不可見。
   */
  ignoreVisibility: boolean = false;
}

// The InteractivityChecker leans heavily on the ally.js accessibility utilities.
// Methods like `isTabbable` are only covering specific edge-cases for the browsers which are
// supported.
// InteractivityChecker在很大程度上依賴ally.js可訪問性實用程序。
// 諸如“ isTabbable”之類的方法僅涵蓋瀏覽器的特定邊緣情況，即
// 支持的。

/**
 * Utility for checking the interactivity of an element, such as whether is is focusable or
 * tabbable.
 * 實用程序，用於檢查元素的交互性，例如是否可聚焦或 tab切換
 * 
 */
@Injectable({ providedIn: 'root' })
export class InteractivityChecker {

  constructor(private _platform: Platform) { }

  /**
   * Gets whether an element is disabled.
   * 獲取元素是否被禁用。
   *
   * @param element Element to be checked.
   * @returns Whether the element is disabled.
   * @param element要檢查的元素。
   * @returns元素是否被禁用。
   */
  isDisabled(element: HTMLElement): boolean {
    // This does not capture some cases, such as a non-form control with a disabled attribute or
    // a form control inside of a disabled form, but should capture the most common cases.
    // 這不會捕獲某些情況，例如具有禁用屬性的非表單控件或
    // 禁用的表單內的表單控件，但應捕獲最常見的情況。
    return element.hasAttribute('disabled');
  }

  /**
   * Gets whether an element is visible for the purposes of interactivity.
   *
   * This will capture states like `display: none` and `visibility: hidden`, but not things like
   * being clipped by an `overflow: hidden` parent or being outside the viewport.
   * 獲取元素是否出於交互目的可見。
   *
   * 這將捕獲“display: none”和“visibility: hidden”之類的狀態，但不會捕獲諸如
   * 被“overflow: hidden”父級或位於視口之外。
   *
   * @returns Whether the element is visible.
   */
  isVisible(element: HTMLElement): boolean {
    return hasGeometry(element) && getComputedStyle(element).visibility === 'visible';
  }

  /**
   * Gets whether an element can be reached via Tab key.
   * Assumes that the element has already been checked with isFocusable.
   * 獲取是否可以通過Tab鍵到達元素。
   * 假定該元素已經用isFocusable檢查過。
   *
   * @param element Element to be checked.
   * @returns Whether the element is tabbable.
   */
  isTabbable(element: HTMLElement): boolean {
    // Nothing is tabbable on the server 😎
    // 服務器上的所有內容都不是可選項
    if (!this._platform.isBrowser) {
      return false;
    }

    const frameElement = getFrameElement(getWindow(element));

    if (frameElement) {
      // Frame elements inherit their tabindex onto all child elements.
      // 框架元素將其tabindex繼承到所有子元素上。
      if (getTabIndexValue(frameElement) === -1) {
        return false;
      }

      // Browsers disable tabbing to an element inside of an invisible frame.
      // 瀏覽器禁用在不可見框架內的元素的製表鍵。
      if (!this.isVisible(frameElement)) {
        return false;
      }
    }

    let nodeName = element.nodeName.toLowerCase();
    let tabIndexValue = getTabIndexValue(element);

    if (element.hasAttribute('contenteditable')) {
      return tabIndexValue !== -1;
    }

    if (nodeName === 'iframe' || nodeName === 'object') {
      // The frame or object's content may be tabbable depending on the content, but it's
      // not possibly to reliably detect the content of the frames. We always consider such
      // elements as non-tabbable.
      // 根據內容的不同，框架或對象的內容可能是 tabbable，但是
      // 無法可靠地檢測框架的內容。我們一直認為這樣
      // non-tabbable 的元素。
      return false;
    }

    // In iOS, the browser only considers some specific elements as tabbable.
    // 在iOS中，瀏覽器僅將某些特定元素視為可選項。
    if (this._platform.WEBKIT && this._platform.IOS && !isPotentiallyTabbableIOS(element)) {
      return false;
    }

    if (nodeName === 'audio') {
      // Audio elements without controls enabled are never tabbable, regardless
      // of the tabindex attribute explicitly being set.
      // 啟用了控件的音頻元素永遠不會成為可選項，無論
      // 顯式設置的tabindex屬性的。
      if (!element.hasAttribute('controls')) {
        return false;
      }
      // Audio elements with controls are by default tabbable unless the
      // tabindex attribute is set to `-1` explicitly.
      // 默認情況下，帶有控件的音頻元素是可選項的，除非
      // tabindex屬性顯式設置為-1。
      return tabIndexValue !== -1;
    }

    if (nodeName === 'video') {
      // For all video elements, if the tabindex attribute is set to `-1`, the video
      // is not tabbable. Note: We cannot rely on the default `HTMLElement.tabIndex`
      // property as that one is set to `-1` in Chrome, Edge and Safari v13.1. The
      // tabindex attribute is the source of truth here.
      //對於所有視頻元素，如果tabindex屬性設置為-1，則視頻 不可tabbable。
      //注意：我們不能依賴默認的HTMLElement.tabIndex屬性，
      //因為在Chrome，Edge和Safari v13.1中將其設置為-1。這
      //這裡的tabindex屬性是信息源(SOT)。
      if (tabIndexValue === -1) {
        return false;
      }
      // If the tabindex is explicitly set, and not `-1` (as per check before), the
      // video element is always tabbable (regardless of whether it has controls or not).
      // 如果tabindex是顯式設置的，而不是“ -1”（按照之前的檢查），則
      // video元素始終是可Tabable的（無論它是否具有控件）。
      if (tabIndexValue !== null) {
        return true;
      }
      // Otherwise (when no explicit tabindex is set), a video is only tabbable if it
      // has controls enabled. Firefox is special as videos are always tabbable regardless
      // of whether there are controls or not.
      // 否則（當未設置任何明確的tabindex時），video 是 tabbable 假如已啟用控件
      //  Firefox 無論如何，video總是tabbable的
      return this._platform.FIREFOX || element.hasAttribute('controls');
    }

    return element.tabIndex >= 0;
  }

  /**
   * Gets whether an element can be focused by the user.
   * 獲取元素是否可以被用戶聚焦。
   *
   * @param element Element to be checked.
   * @param config The config object with options to customize this method's behavior
   * @returns Whether the element is focusable.
   * @param element要檢查的元素。
   * @param config帶有可自定義此方法行為的選項的config對象
   * @returns元素是否可聚焦。
   */
  isFocusable(element: HTMLElement, config?: IsFocusableConfig): boolean {
    // Perform checks in order of left to most expensive.
    // Again, naive approach that does not capture many edge cases and browser quirks.
    // 按照從left到expensive的順序執行檢查。
    // 同樣，這種幼稚的方法無法捕獲許多極端情況和瀏覽器 quriks 模式。
    return isPotentiallyFocusable(element) && !this.isDisabled(element) &&
      (config?.ignoreVisibility || this.isVisible(element));
  }

}

/**
 * Returns the frame element from a window object. Since browsers like MS Edge throw errors if
 * the frameElement property is being accessed from a different host address, this property
 * should be accessed carefully.
 * 从窗口对象返回frameElement。由于像MS Edge这样的浏览器会在以下情况下引发错误：
 * 从其他主机地址访问frameElement属性，此属性
 * 应仔细访问。
 */
function getFrameElement(window: Window) {
  try {
    return window.frameElement as HTMLElement;
  } catch {
    return null;
  }
}

/** Checks whether the specified element has any geometry / rectangles. */
// / **检查指定的元素是否具有任何几何形状/矩形。 * /
function hasGeometry(element: HTMLElement): boolean {
  // Use logic from jQuery to check for an invisible element.
  // 使用jQuery的逻辑检查不可见的元素。
  // See https://github.com/jquery/jquery/blob/master/src/css/hiddenVisibleSelectors.js#L12
  return !!(element.offsetWidth || element.offsetHeight ||
    (typeof element.getClientRects === 'function' && element.getClientRects().length));
}

/** Gets whether an element's  */
// 获取元素的
function isNativeFormElement(element: Node) {
  let nodeName = element.nodeName.toLowerCase();
  return nodeName === 'input' ||
    nodeName === 'select' ||
    nodeName === 'button' ||
    nodeName === 'textarea';
}

/** Gets whether an element is an `<input type="hidden">`. */
// 获取元素是否为<input type =“ hidden”>`。 
function isHiddenInput(element: HTMLElement): boolean {
  return isInputElement(element) && element.type == 'hidden';
}

/** Gets whether an element is an anchor that has an href attribute. */
// 獲取元素是否是具有href屬性的錨。
function isAnchorWithHref(element: HTMLElement): boolean {
  return isAnchorElement(element) && element.hasAttribute('href');
}

/** Gets whether an element is an input element. */
// 獲取元素是否為輸入元素。 
function isInputElement(element: HTMLElement): element is HTMLInputElement {
  return element.nodeName.toLowerCase() == 'input';
}

/** Gets whether an element is an anchor element. 
 *  獲取元素是否為錨元素。
*/
function isAnchorElement(element: HTMLElement): element is HTMLAnchorElement {
  return element.nodeName.toLowerCase() == 'a';
}

/** Gets whether an element has a valid tabindex. 
 * 獲取元素是否具有有效的tabindex。
*/
function hasValidTabIndex(element: HTMLElement): boolean {
  if (!element.hasAttribute('tabindex') || element.tabIndex === undefined) {
    return false;
  }

  let tabIndex = element.getAttribute('tabindex');

  // IE11 parses tabindex="" as the value "-32768"
  // IE11將tabindex =“”解析為值“ -32768”
  if (tabIndex == '-32768') {
    return false;
  }

  return !!(tabIndex && !isNaN(parseInt(tabIndex, 10)));
}

/**
 * Returns the parsed tabindex from the element attributes instead of returning the
 * evaluated tabindex from the browsers defaults.
 * 從元素屬性返回已解析的tabindex，而不是返回
 * 根據瀏覽器的默認值評估tabindex。
 */
function getTabIndexValue(element: HTMLElement): number | null {
  if (!hasValidTabIndex(element)) {
    return null;
  }

  // See browser issue in Gecko https://bugzilla.mozilla.org/show_bug.cgi?id=1128054
  // 請參閱Gecko中的瀏覽器問題https://bugzilla.mozilla.org/show_bug.cgi?id=1128054
  const tabIndex = parseInt(element.getAttribute('tabindex') || '', 10);

  return isNaN(tabIndex) ? -1 : tabIndex;
}

/** Checks whether the specified element is potentially tabbable on iOS
 * 檢查指定的元素在iOS上是否可能可Tabable
 */
function isPotentiallyTabbableIOS(element: HTMLElement): boolean {
  let nodeName = element.nodeName.toLowerCase();
  let inputType = nodeName === 'input' && (element as HTMLInputElement).type;

  return inputType === 'text'
    || inputType === 'password'
    || nodeName === 'select'
    || nodeName === 'textarea';
}

/**
 * Gets whether an element is potentially focusable without taking current visible/disabled state
 * into account.
 * 獲取一個元素是否潛在地可聚焦而不採用當前的可見/禁用狀態
 * 考慮在內。
 */
function isPotentiallyFocusable(element: HTMLElement): boolean {
  // Inputs are potentially focusable *unless* they're type="hidden".
  // 輸入可能是可聚焦的*除非*類型為“ hidden”。
  if (isHiddenInput(element)) {
    return false;
  }

  return isNativeFormElement(element) ||
    isAnchorWithHref(element) ||
    element.hasAttribute('contenteditable') ||
    hasValidTabIndex(element);
}

/** Gets the parent window of a DOM node with regards of being inside of an iframe. 
 * 獲取位於iframe內部的DOM節點的父窗口。
*/
function getWindow(node: HTMLElement): Window {
  // ownerDocument is null if `node` itself *is* a document.
  // 如果`node`本身是一個文檔，ownerDocument為null。
  return node.ownerDocument && node.ownerDocument.defaultView || window;
}
