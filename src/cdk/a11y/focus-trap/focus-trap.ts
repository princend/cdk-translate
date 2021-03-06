/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOCUMENT } from '@angular/common';
import {
  AfterContentInit,
  Directive,
  ElementRef,
  Inject,
  Injectable,
  Input,
  NgZone,
  OnDestroy,
  DoCheck,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { take } from 'rxjs/operators';
import { InteractivityChecker } from '../interactivity-checker/interactivity-checker';


/**
 * Class that allows for trapping focus within a DOM element.
 *
 * This class currently uses a relatively simple approach to focus trapping.
 * It assumes that the tab order is the same as DOM order, which is not necessarily true.
 * Things like `tabIndex > 0`, flex `order`, and shadow roots can cause the two to misalign.
 * 允許在DOM元素內捕獲焦點的類。
 *
 * 此類當前使用相對簡單的方法來進行焦點trapping。
 * 假定製表符順序與DOM順序相同，但不一定正確。
 * 諸如“ tabIndex> 0”，“伸縮”順序和陰影根之類的東西都可能導致兩者未對齊。
 *
 * @deprecated Use `ConfigurableFocusTrap` instead.
 * @breaking-change for 11.0.0 Remove this class.
 * @deprecated 改用`ConfigurableFocusTrap`。
 * @ 0.0.11的@ breaking-change刪除此類。
 */
export class FocusTrap {
  private _startAnchor: HTMLElement | null;
  private _endAnchor: HTMLElement | null;
  private _hasAttached = false;

  // Event listeners for the anchors. Need to be regular functions so that we can unbind them later.
  // 錨點的事件偵聽器。需要是常規函數，以便我們以後可以將它們解除綁定。
  protected startAnchorListener = () => this.focusLastTabbableElement();
  protected endAnchorListener = () => this.focusFirstTabbableElement();

  /** Whether the focus trap is active. */
  // 聚焦陷阱是否處於活動狀態。
  get enabled(): boolean { return this._enabled; }
  set enabled(value: boolean) {
    this._enabled = value;

    if (this._startAnchor && this._endAnchor) {
      this._toggleAnchorTabIndex(value, this._startAnchor);
      this._toggleAnchorTabIndex(value, this._endAnchor);
    }
  }
  protected _enabled: boolean = true;

  constructor(
    readonly _element: HTMLElement,
    private _checker: InteractivityChecker,
    readonly _ngZone: NgZone,
    readonly _document: Document,
    deferAnchors = false) {

    if (!deferAnchors) {
      this.attachAnchors();
    }
  }

  /** Destroys the focus trap by cleaning up the anchors. */
  //清理錨點以破壞聚焦陷阱。
  destroy() {
    const startAnchor = this._startAnchor;
    const endAnchor = this._endAnchor;

    if (startAnchor) {
      startAnchor.removeEventListener('focus', this.startAnchorListener);

      if (startAnchor.parentNode) {
        startAnchor.parentNode.removeChild(startAnchor);
      }
    }

    if (endAnchor) {
      endAnchor.removeEventListener('focus', this.endAnchorListener);

      if (endAnchor.parentNode) {
        endAnchor.parentNode.removeChild(endAnchor);
      }
    }

    this._startAnchor = this._endAnchor = null;
    this._hasAttached = false;
  }

  /**
   * Inserts the anchors into the DOM. This is usually done automatically
   * in the constructor, but can be deferred for cases like directives with `*ngIf`.
   * @returns Whether the focus trap managed to attach successfuly. This may not be the case
   * if the target element isn't currently in the DOM.
   * 將錨點插入DOM。通常這是自動完成的
   * 在構造函數中，但對於諸如帶有* ngIf`指令的情況可以推遲。
   * @returns聚焦陷阱是否成功連接。情況可能並非如此
   * 如果目標元素當前不在DOM中。
   */
  attachAnchors(): boolean {
    // If we're not on the browser, there can be no focus to trap.
    // 如果我們不在瀏覽器上，就不會有任何trap。
    if (this._hasAttached) {
      return true;
    }

    this._ngZone.runOutsideAngular(() => {
      if (!this._startAnchor) {
        this._startAnchor = this._createAnchor();
        this._startAnchor!.addEventListener('focus', this.startAnchorListener);
      }

      if (!this._endAnchor) {
        this._endAnchor = this._createAnchor();
        this._endAnchor!.addEventListener('focus', this.endAnchorListener);
      }
    });

    if (this._element.parentNode) {
      this._element.parentNode.insertBefore(this._startAnchor!, this._element);
      this._element.parentNode.insertBefore(this._endAnchor!, this._element.nextSibling);
      this._hasAttached = true;
    }

    return this._hasAttached;
  }

  /**
   * Waits for the zone to stabilize, then either focuses the first element that the
   * user specified, or the first tabbable element.
   * @returns Returns a promise that resolves with a boolean, depending
   * on whether focus was moved successfully.
   * 等待區域穩定，然後將焦點放在第一個元素上
   * 用戶指定的，或第一個可標籤元素。
   * @returns返回一個 Promise<boolean>，具體取決於
   * 焦點是否成功轉移。
   */
  focusInitialElementWhenReady(options?: FocusOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._executeOnStable(() => resolve(this.focusInitialElement(options)));
    });
  }

  /**
   * Waits for the zone to stabilize, then focuses
   * the first tabbable element within the focus trap region.
   * @returns Returns a promise that resolves with a boolean, depending
   * on whether focus was moved successfully.
   * 等待區域穩定，然後聚焦
   * 焦點陷阱區域內的第一個可tabbable元素。 (tabable 可以被tab鍵切換的)
   * @returns返回一個Promise<boolean>，具體取決於
   * 焦點是否成功轉移。
   */
  focusFirstTabbableElementWhenReady(options?: FocusOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._executeOnStable(() => resolve(this.focusFirstTabbableElement(options)));
    });
  }

  /**
   * Waits for the zone to stabilize, then focuses
   * the last tabbable element within the focus trap region.
   * @returns Returns a promise that resolves with a boolean, depending
   * on whether focus was moved successfully.
   * 等待區域穩定，然後聚焦
   * 焦點陷阱區域內的最後一個可tabbable元素。
   * @returns返回一個Promise<boolean>，具體取決於
   * 焦點是否成功轉移。
   */
  focusLastTabbableElementWhenReady(options?: FocusOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._executeOnStable(() => resolve(this.focusLastTabbableElement(options)));
    });
  }

  /**
   * Get the specified boundary element of the trapped region.
   * @param bound The boundary to get (start or end of trapped region).
   * @returns The boundary element.
   * 獲取trapped區域的指定邊界元素。
   * @param bound獲取的邊界（捕獲區域的開始或結束）。
   * @returns邊界元素。
   */
  private _getRegionBoundary(bound: 'start' | 'end'): HTMLElement | null {
    // Contains the deprecated version of selector, for temporary backwards comparability.
    let markers = this._element.querySelectorAll(`[cdk-focus-region-${bound}], ` +
      `[cdkFocusRegion${bound}], ` +
      `[cdk-focus-${bound}]`) as NodeListOf<HTMLElement>;

    for (let i = 0; i < markers.length; i++) {
      // @breaking-change 8.0.0
      if (markers[i].hasAttribute(`cdk-focus-${bound}`)) {
        console.warn(`Found use of deprecated attribute 'cdk-focus-${bound}', ` +
          `use 'cdkFocusRegion${bound}' instead. The deprecated ` +
          `attribute will be removed in 8.0.0.`, markers[i]);
      } else if (markers[i].hasAttribute(`cdk-focus-region-${bound}`)) {
        console.warn(`Found use of deprecated attribute 'cdk-focus-region-${bound}', ` +
          `use 'cdkFocusRegion${bound}' instead. The deprecated attribute ` +
          `will be removed in 8.0.0.`, markers[i]);
      }
    }

    if (bound == 'start') {
      return markers.length ? markers[0] : this._getFirstTabbableElement(this._element);
    }
    return markers.length ?
      markers[markers.length - 1] : this._getLastTabbableElement(this._element);
  }

  /**
   * Focuses the element that should be focused when the focus trap is initialized.
   * @returns Whether focus was moved successfully.
   * 聚焦在初始化聚焦陷阱時應聚焦的元素。
   * @returns焦點是否成功移動。
   */
  focusInitialElement(options?: FocusOptions): boolean {
    // Contains the deprecated version of selector, for temporary backwards comparability.
    const redirectToElement = this._element.querySelector(`[cdk-focus-initial], ` +
      `[cdkFocusInitial]`) as HTMLElement;

    if (redirectToElement) {
      // @breaking-change 8.0.0
      if (redirectToElement.hasAttribute(`cdk-focus-initial`)) {
        console.warn(`Found use of deprecated attribute 'cdk-focus-initial', ` +
          `use 'cdkFocusInitial' instead. The deprecated attribute ` +
          `will be removed in 8.0.0`, redirectToElement);
      }

      // Warn the consumer if the element they've pointed to
      // isn't focusable, when not in production mode.
      // 警告consumer，如果他們指向的元素
      // 如果不在生產模式下，則無法聚焦。
      if ((typeof ngDevMode === 'undefined' || ngDevMode) &&
        !this._checker.isFocusable(redirectToElement)) {
        console.warn(`Element matching '[cdkFocusInitial]' is not focusable.`, redirectToElement);
      }

      if (!this._checker.isFocusable(redirectToElement)) {
        const focusableChild = this._getFirstTabbableElement(redirectToElement) as HTMLElement;
        focusableChild?.focus(options);
        return !!focusableChild;
      }

      redirectToElement.focus(options);
      return true;
    }

    return this.focusFirstTabbableElement(options);
  }

  /**
   * Focuses the first tabbable element within the focus trap region.
   * @returns Whether focus was moved successfully.
   * 在焦點陷阱區域內聚焦第一個 tabbable 元素。
   * @returns焦點是否成功移動。
   */
  focusFirstTabbableElement(options?: FocusOptions): boolean {
    const redirectToElement = this._getRegionBoundary('start');

    if (redirectToElement) {
      redirectToElement.focus(options);
    }

    return !!redirectToElement;
  }

  /**
   * Focuses the last tabbable element within the focus trap region.
   * @returns Whether focus was moved successfully.
   * 在焦點陷阱區域內聚焦最後一個可Tabbable元素。
   * @returns焦點是否成功移動。
   */
  focusLastTabbableElement(options?: FocusOptions): boolean {
    const redirectToElement = this._getRegionBoundary('end');

    if (redirectToElement) {
      redirectToElement.focus(options);
    }

    return !!redirectToElement;
  }

  /**
   * Checks whether the focus trap has successfully been attached.
   * 檢查對焦陷阱是否已成功安裝。
   */
  hasAttached(): boolean {
    return this._hasAttached;
  }

  /** Get the first tabbable element from a DOM subtree (inclusive). */
  // 從DOM子樹（包括DOM）中獲取第一個tabbable元素。
  private _getFirstTabbableElement(root: HTMLElement): HTMLElement | null {
    if (this._checker.isFocusable(root) && this._checker.isTabbable(root)) {
      return root;
    }

    // Iterate in DOM order. Note that IE doesn't have `children` for SVG so we fall
    // back to `childNodes` which includes text nodes, comments etc.
    // 以DOM順序進行迭代。請注意，IE沒有SVG的“子級”，因此我們
    // 返回“ childNodes”，其中包括文本節點，註釋等。
    let children = root.children || root.childNodes;

    for (let i = 0; i < children.length; i++) {
      let tabbableChild = children[i].nodeType === this._document.ELEMENT_NODE ?
        this._getFirstTabbableElement(children[i] as HTMLElement) :
        null;

      if (tabbableChild) {
        return tabbableChild;
      }
    }

    return null;
  }

  /** Get the last tabbable element from a DOM subtree (inclusive). */
  //*從DOM子樹（包括DOM）中獲取最後一個可標籤元素。 
  private _getLastTabbableElement(root: HTMLElement): HTMLElement | null {
    if (this._checker.isFocusable(root) && this._checker.isTabbable(root)) {
      return root;
    }

    // Iterate in reverse DOM order.
    // 以相反的DOM順序進行迭代。
    let children = root.children || root.childNodes;

    for (let i = children.length - 1; i >= 0; i--) {
      let tabbableChild = children[i].nodeType === this._document.ELEMENT_NODE ?
        this._getLastTabbableElement(children[i] as HTMLElement) :
        null;

      if (tabbableChild) {
        return tabbableChild;
      }
    }

    return null;
  }

  /** Creates an anchor element. */
  // 創建錨元素。
  private _createAnchor(): HTMLElement {
    const anchor = this._document.createElement('div');
    this._toggleAnchorTabIndex(this._enabled, anchor);
    anchor.classList.add('cdk-visually-hidden');
    anchor.classList.add('cdk-focus-trap-anchor');
    anchor.setAttribute('aria-hidden', 'true');
    return anchor;
  }

  /**
   * Toggles the `tabindex` of an anchor, based on the enabled state of the focus trap.
   * @param isEnabled Whether the focus trap is enabled.
   * @param anchor Anchor on which to toggle the tabindex.
   * 根據焦點陷阱的啟用狀態來切換錨點的“ tabindex”。
   * @param isEnabled是否啟用了焦點陷阱。
   * @param anchor錨，用於在其上切換tabindex。
   */
  private _toggleAnchorTabIndex(isEnabled: boolean, anchor: HTMLElement) {
    // Remove the tabindex completely, rather than setting it to -1, because if the
    // element has a tabindex, the user might still hit it when navigating with the arrow keys.
    //完全刪除tabindex，而不是將其設置為-1，因為如果
    //元素具有tabindex，用戶在使用箭頭鍵導航時仍可能會點擊它。
    // tabindex 參考 https://developers.google.com/web/fundamentals/accessibility/focus/using-tabindex?hl=zh-tw
    isEnabled ? anchor.setAttribute('tabindex', '0') : anchor.removeAttribute('tabindex');
  }

  /**
   * Toggles the`tabindex` of both anchors to either trap Tab focus or allow it to escape.
   * @param enabled: Whether the anchors should trap Tab.
   * 切換兩個錨點的“ tabindex”以捕獲Tab焦點或使其脫離。
   * 已啟用@param：錨點是否應捕獲Tab。
   */
  protected toggleAnchors(enabled: boolean) {
    if (this._startAnchor && this._endAnchor) {
      this._toggleAnchorTabIndex(enabled, this._startAnchor);
      this._toggleAnchorTabIndex(enabled, this._endAnchor);
    }
  }

  /** Executes a function when the zone is stable. */
  // 當區域穩定時執行功能。 
  private _executeOnStable(fn: () => any): void {
    if (this._ngZone.isStable) {
      fn();
    } else {
      this._ngZone.onStable.pipe(take(1)).subscribe(fn);
    }
  }
}

/**
 * Factory that allows easy instantiation of focus traps.
 * @deprecated Use `ConfigurableFocusTrapFactory` instead.
 * @breaking-change for 11.0.0 Remove this class.
 * 允許輕鬆實例化 focus trap 的工廠。
 * @不建議使用`ConfigurableFocusTrapFactory`來代替。
 * @ 0.0.11的@ breaking-change刪除此類。
 */
@Injectable({ providedIn: 'root' })
export class FocusTrapFactory {
  private _document: Document;

  constructor(
    private _checker: InteractivityChecker,
    private _ngZone: NgZone,
    @Inject(DOCUMENT) _document: any) {

    this._document = _document;
  }

  /**
   * Creates a focus-trapped region around the given element.
   * @param element The element around which focus will be trapped.
   * @param deferCaptureElements Defers the creation of focus-capturing elements to be done
   *     manually by the user.
   * @returns The created focus trap instance.
   * 在給定元素周圍創建一個焦點捕獲區域。
   * @param元素將圍繞其捕獲焦點的元素。
   * @param deferCaptureElements推遲創建焦點捕獲元素
   * 由用戶手動執行。
   * @returns創建的焦點陷阱實例。
   */
  create(element: HTMLElement, deferCaptureElements: boolean = false): FocusTrap {
    return new FocusTrap(
      element, this._checker, this._ngZone, this._document, deferCaptureElements);
  }
}

/** Directive for trapping focus within a region. */
// 在區域內捕獲焦點的指令。
@Directive({
  selector: '[cdkTrapFocus]',
  exportAs: 'cdkTrapFocus',
})
export class CdkTrapFocus implements OnDestroy, AfterContentInit, OnChanges, DoCheck {
  private _document: Document;

  /** Underlying FocusTrap instance. */
  // 基礎FocusTrap實例。 
  focusTrap: FocusTrap;

  /** Previously focused element to restore focus to upon destroy when using autoCapture. */
  // 使用autoCapture時，先前已聚焦的元素可將焦點恢復為銷毀。
  private _previouslyFocusedElement: HTMLElement | null = null;

  /** Whether the focus trap is active. */
  // 聚焦陷阱是否處於活動狀態。
  @Input('cdkTrapFocus')
  get enabled(): boolean { return this.focusTrap.enabled; }
  set enabled(value: boolean) { this.focusTrap.enabled = coerceBooleanProperty(value); }

  /**
   * Whether the directive should automatically move focus into the trapped region upon
   * initialization and return focus to the previous activeElement upon destruction.
   * 指令是否應在以下情況下自動將焦點移到陷阱區域中：
   * 初始化，並在銷毀時將焦點返回到先前的activeElement。
   */
  @Input('cdkTrapFocusAutoCapture')
  get autoCapture(): boolean { return this._autoCapture; }
  set autoCapture(value: boolean) { this._autoCapture = coerceBooleanProperty(value); }
  private _autoCapture: boolean;

  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _focusTrapFactory: FocusTrapFactory,
    @Inject(DOCUMENT) _document: any) {

    this._document = _document;
    this.focusTrap = this._focusTrapFactory.create(this._elementRef.nativeElement, true);
  }

  ngOnDestroy() {
    this.focusTrap.destroy();

    // If we stored a previously focused element when using autoCapture, return focus to that
    // element now that the trapped region is being destroyed.
    // 如果在使用autoCapture時存儲了先前關注的元素，則將焦點返回到該元素
    // 元素說明被捕獲的區域正在被銷毀。
    if (this._previouslyFocusedElement) {
      this._previouslyFocusedElement.focus();
      this._previouslyFocusedElement = null;
    }
  }

  ngAfterContentInit() {
    this.focusTrap.attachAnchors();

    if (this.autoCapture) {
      this._captureFocus();
    }
  }

  ngDoCheck() {
    if (!this.focusTrap.hasAttached()) {
      this.focusTrap.attachAnchors();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const autoCaptureChange = changes['autoCapture'];

    if (autoCaptureChange && !autoCaptureChange.firstChange && this.autoCapture &&
      this.focusTrap.hasAttached()) {
      this._captureFocus();
    }
  }

  private _captureFocus() {
    this._previouslyFocusedElement = this._document.activeElement as HTMLElement;
    this.focusTrap.focusInitialElementWhenReady();
  }

  static ngAcceptInputType_enabled: BooleanInput;
  static ngAcceptInputType_autoCapture: BooleanInput;

  // static 參考 https://medium.com/enjoy-life-enjoy-coding/typescript-從-ts-開始學習物件導向-class-用法-20ade3ce26b8
}
