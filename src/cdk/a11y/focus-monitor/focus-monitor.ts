/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Platform, normalizePassiveListenerOptions, _getShadowRoot } from '@angular/cdk/platform';
import {
  Directive,
  ElementRef,
  EventEmitter,
  Inject,
  Injectable,
  InjectionToken,
  NgZone,
  OnDestroy,
  Optional,
  Output,
  AfterViewInit,
} from '@angular/core';
import { Observable, of as observableOf, Subject, Subscription } from 'rxjs';
import { coerceElement } from '@angular/cdk/coercion';
import { DOCUMENT } from '@angular/common';
import { isFakeMousedownFromScreenReader } from '../fake-mousedown';


// This is the value used by AngularJS Material. Through trial and error (on iPhone 6S) they found
// that a value of around 650ms seems appropriate.
export const TOUCH_BUFFER_MS = 650;


export type FocusOrigin = 'touch' | 'mouse' | 'keyboard' | 'program' | null;

/**
 * Corresponds to the options that can be passed to the native `focus` event.
 * via https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus
 */
export interface FocusOptions {
  /** Whether the browser should scroll to the element when it is focused. */
  preventScroll?: boolean;
}

/** Detection mode used for attributing the origin of a focus event. */
export const enum FocusMonitorDetectionMode {
  /**
   * Any mousedown, keydown, or touchstart event that happened in the previous
   * tick or the current tick will be used to assign a focus event's origin (to
   * either mouse, keyboard, or touch). This is the default option.
   * 上一次發生的任何mousedown，keydown或touchstart事件
   * tick或當前tick將用於分配焦點事件的來源（以
   * 鼠標，鍵盤或觸摸）。這是默認選項。
   */
  IMMEDIATE,
  /**
   * A focus event's origin is always attributed to the last corresponding
   * mousedown, keydown, or touchstart event, no matter how long ago it occured.
   * 焦點事件的origin總是歸因於最後一個對應事件
   * mousedown，keydown或touchstart事件，無論它發生多久了。
   */
  EVENTUAL
}

/** Injectable service-level options for FocusMonitor. 
 * FocusMonitor的可注入服務級別選項
*/
export interface FocusMonitorOptions {
  detectionMode?: FocusMonitorDetectionMode;
}

/** InjectionToken for FocusMonitorOptions. */
export const FOCUS_MONITOR_DEFAULT_OPTIONS =
  new InjectionToken<FocusMonitorOptions>('cdk-focus-monitor-default-options');

type MonitoredElementInfo = {
  checkChildren: boolean,
  subject: Subject<FocusOrigin>,
  rootNode: HTMLElement | ShadowRoot | Document
};

/**
 * Event listener options that enable capturing and also
 * mark the listener as passive if the browser supports it.
 * 事件偵聽器選項可實現捕獲以及
 * 如果瀏覽器支持，則將偵聽器標記為被動。
 */
const captureEventListenerOptions = normalizePassiveListenerOptions({
  passive: true,
  capture: true
});


/** Monitors mouse and keyboard events to determine the cause of focus events. */
@Injectable({ providedIn: 'root' })
export class FocusMonitor implements OnDestroy {
  /** The focus origin that the next focus event is a result of. */
  /** 下一個焦點事件所產生的焦點來源。 */
  private _origin: FocusOrigin = null;

  /** The FocusOrigin of the last focus event tracked by the FocusMonitor. */
  // FocusMonitor跟踪的最後一個焦點事件的FocusOrigin。
  private _lastFocusOrigin: FocusOrigin;

  /** Whether the window has just been focused. */
  //窗口是否剛剛聚焦。
  private _windowFocused = false;

  /** The target of the last touch event. */
  // 上次觸摸事件的目標。
  private _lastTouchTarget: EventTarget | null;

  /** The timeout id of the touch timeout, used to cancel timeout later. */
  //觸摸超時的超時ID，用於以後取消超時。
  private _touchTimeoutId: number;

  /** The timeout id of the window focus timeout. */
  // 窗口焦點超時的超時ID。
  private _windowFocusTimeoutId: number;

  /** The timeout id of the origin clearing timeout. */
  // 用來記錄清除timeout的id。
  private _originTimeoutId: number;

  /** Map of elements being monitored to their info. */
  // 被監視元素與其信息的映射。
  private _elementInfo = new Map<HTMLElement, MonitoredElementInfo>();

  /** The number of elements currently being monitored. */
  // 當前正在監視的元素數。
  private _monitoredElementCount = 0;

  /**
   * Keeps track of the root nodes to which we've currently bound a focus/blur handler,
   * as well as the number of monitored elements that they contain. We have to treat focus/blur
   * handlers differently from the rest of the events, because the browser won't emit events
   * to the document when focus moves inside of a shadow root.
   * 跟踪我們當前已將焦點/模糊處理程序綁定到的根節點，
   * 以及它們包含的受監視元素的數量。我們必須對待焦點/模糊
   * 處理程序與其他事件不同，因為瀏覽器不會發出事件
   * 當焦點移到shadowRoot時，顯示到文檔中。
   */
  private _rootNodeFocusListenerCount = new Map<HTMLElement | Document | ShadowRoot, number>();

  /**
   * The specified detection mode, used for attributing the origin of a focus
   * event.
   * 指定的檢測模式，用於賦予屬性於焦點
   * 事件。
   */
  private readonly _detectionMode: FocusMonitorDetectionMode;

  /**
   *  文檔上的“ keydown”事件的事件偵聽器。
   * 需要是一個箭頭函數，以便在綁定上下文時保留上下文。
   * Event listener for `keydown` events on the document.
   * Needs to be an arrow function in order to preserve the context when it gets bound.
   */

  private _documentKeydownListener = () => {
    // On keydown record the origin and clear any touch event that may be in progress.
    // 按下鍵盤時，記錄原點並清除可能正在進行的任何觸摸事件。
    this._lastTouchTarget = null;
    this._setOriginForCurrentEventQueue('keyboard');
  }

  /**
   * 
   * 文檔上的“ keydown”事件的事件偵聽器。
   * 需要是一個箭頭函數，以便在綁定上下文時保留上下文。

   * Event listener for `mousedown` events on the document.
   * Needs to be an arrow function in order to preserve the context when it gets bound.
   */
  private _documentMousedownListener = (event: MouseEvent) => {
    // On mousedown record the origin only if there is not touch
    // target, since a mousedown can happen as a result of a touch event.
    if (!this._lastTouchTarget) {
      //在某些情況下，屏幕閱讀器會觸發偽造的`mousedown`事件而不是`keydown`事件。
      //如果我們檢測到焦點源之一，則將焦點源解析為“鍵盤”。
      // In some cases screen readers fire fake `mousedown` events instead of `keydown`.
      // Resolve the focus source to `keyboard` if we detect one of them.
      const source = isFakeMousedownFromScreenReader(event) ? 'keyboard' : 'mouse';
      this._setOriginForCurrentEventQueue(source);
    }
  }

  /**
   * Event listener for `touchstart` events on the document.
   * Needs to be an arrow function in order to preserve the context when it gets bound.
   * 文檔上“ touchstart”事件的事件監聽器。
   * 需要是一個箭頭函數，以便在綁定上下文時保留上下文。
   */
  private _documentTouchstartListener = (event: TouchEvent) => {
    // When the touchstart event fires the focus event is not yet in the event queue. This means
    // we can't rely on the trick used above (setting timeout of 1ms). Instead we wait 650ms to
    // see if a focus happens.
    //當touchstart事件觸發時，焦點事件尚未在事件隊列中。這表示
    //我們不能依靠上面使用的技巧（將超時設置為1ms）。相反，我們等待650毫秒
    //查看焦點是否發生。
    if (this._touchTimeoutId != null) {
      clearTimeout(this._touchTimeoutId);
    }

    this._lastTouchTarget = getTarget(event);
    this._touchTimeoutId = setTimeout(() => this._lastTouchTarget = null, TOUCH_BUFFER_MS);
  }

  /**
   * Event listener for `focus` events on the window.
   * Needs to be an arrow function in order to preserve the context when it gets bound.
   * 窗口上的`focus`事件的事件監聽器。
   * 需要是一個箭頭函數，以便在綁定上下文時保留上下文。
   */
  private _windowFocusListener = () => {
    // Make a note of when the window regains focus, so we can
    // restore the origin info for the focused element.
    //記下窗口何時重新獲得焦點，這樣我們就可以
    //恢復焦點元素的原點信息。
    this._windowFocused = true;
    this._windowFocusTimeoutId = setTimeout(() => this._windowFocused = false);
  }

  /** Used to reference correct document/window */
  protected _document?: Document;

  constructor(
    private _ngZone: NgZone, // 參考 https://ithelp.ithome.com.tw/articles/10208831
    private _platform: Platform,
    /** @breaking-change 11.0.0 make document required */
    @Optional() @Inject(DOCUMENT) document: any | null,
    @Optional() @Inject(FOCUS_MONITOR_DEFAULT_OPTIONS) options:
      FocusMonitorOptions | null) {
    this._document = document;
    this._detectionMode = options?.detectionMode || FocusMonitorDetectionMode.IMMEDIATE;
  }
  /**
   * Event listener for `focus` and 'blur' events on the document.
   * Needs to be an arrow function in order to preserve the context when it gets bound.
   * 事件偵聽器，用於文檔上的“焦點”和“模糊”事件。
   * 需要是一個箭頭函數，以便在綁定上下文時保留上下文。
   */
  private _rootNodeFocusAndBlurListener = (event: Event) => {
    const target = getTarget(event);
    const handler = event.type === 'focus' ? this._onFocus : this._onBlur;

    // We need to walk up the ancestor chain in order to support `checkChildren`.
    // 為了支持`checkChildren`，我們需要走在祖先鏈上。
    // call , apply ,bind 參考 https://www.fooish.com/javascript/this.html
    for (let element = target; element; element = element.parentElement) {
      handler.call(this, event as FocusEvent, element);
    }
  }

  /**
   * Monitors focus on an element and applies appropriate CSS classes.
   * @param element The element to monitor
   * @param checkChildren Whether to count the element as focused when its children are focused.
   * @returns An observable that emits when the focus state of the element changes.
   *     When the element is blurred, null will be emitted.
   * 監控程序將重點放在元素上，並應用適當的CSS類。
   * @param元素要監視的元素
   * @param checkChildren當元素的子元素被聚焦時是否將元素歸為聚焦。
   * @returns當元素的焦點狀態更改時發出的可觀察對象。
   * 當元素模糊時，將發出null。
   */
  monitor(element: HTMLElement, checkChildren?: boolean): Observable<FocusOrigin>;

  /**
   * Monitors focus on an element and applies appropriate CSS classes.
   * @param element The element to monitor
   * @param checkChildren Whether to count the element as focused when its children are focused.
   * @returns An observable that emits when the focus state of the element changes.
   *     When the element is blurred, null will be emitted.
   * 監視集中在元素上，並應用適當的CSS類。
   * @param元素要監視的元素
   * @param checkChildren當元素的子元素被聚焦時是否將元素歸為聚焦。
   * @returns當元素的焦點狀態更改時發出的可觀察對象。
   * 當元素模糊時，將發出null。
   */
  monitor(element: ElementRef<HTMLElement>, checkChildren?: boolean): Observable<FocusOrigin>;

  monitor(element: HTMLElement | ElementRef<HTMLElement>,
    checkChildren: boolean = false): Observable<FocusOrigin> {
    const nativeElement = coerceElement(element); //強迫回傳 HTMLElement 型別 參考:https://ithelp.ithome.com.tw/articles/10197609

    // Do nothing if we're not on the browser platform or the passed in node isn't an element.
    // 如果我們不在瀏覽器平台上，或者傳入的節點不是元素，則不執行任何操作。
    if (!this._platform.isBrowser || nativeElement.nodeType !== 1) {
      return observableOf(null);
    }

    // If the element is inside the shadow DOM, we need to bind our focus/blur listeners to
    // the shadow root, rather than the `document`, because the browser won't emit focus events
    // to the `document`, if focus is moving within the same shadow root.
    // 如果元素在影子DOM內，則需要將焦點/模糊監聽器綁定到
    // 陰影根目錄，而不是`document`，因為瀏覽器不會發出焦點事件
    // 如果焦點在同一ShadowRoot內移動，則移至`document`。
    const rootNode = _getShadowRoot(nativeElement) || this._getDocument();
    const cachedInfo = this._elementInfo.get(nativeElement);

    // Check if we're already monitoring this element.
    //檢查我們是否已經在監視此元素。
    if (cachedInfo) {
      if (checkChildren) {
        // TODO(COMP-318): this can be problematic, because it'll turn all non-checkChildren
        // observers into ones that behave as if `checkChildren` was turned on. We need a more
        // robust solution.
        // TODO（COMP-318）：這可能會有問題，因為它將所有非checkChildren
        //將觀察者變成行為類似於“ checkChildren”已打開的行為。我們需要更多
        //健壯的解決方案。
        cachedInfo.checkChildren = true;
      }

      return cachedInfo.subject;
    }

    // Create monitored element info.
    //創建監視的元素信息。
    const info: MonitoredElementInfo = {
      checkChildren: checkChildren,
      subject: new Subject<FocusOrigin>(),
      rootNode
    };
    this._elementInfo.set(nativeElement, info);
    this._registerGlobalListeners(info);

    return info.subject;
  }

  /**
   * Stops monitoring an element and removes all focus classes.
   * @param element The element to stop monitoring.
   * 停止監視元素並刪除所有焦點類。
   * @param元素停止監視的元素。
   */
  stopMonitoring(element: HTMLElement): void;

  /**
   * Stops monitoring an element and removes all focus classes.
   * @param element The element to stop monitoring.
   */
  stopMonitoring(element: ElementRef<HTMLElement>): void;

  stopMonitoring(element: HTMLElement | ElementRef<HTMLElement>): void {
    const nativeElement = coerceElement(element);
    const elementInfo = this._elementInfo.get(nativeElement);

    if (elementInfo) {
      elementInfo.subject.complete();

      this._setClasses(nativeElement);
      this._elementInfo.delete(nativeElement);
      this._removeGlobalListeners(elementInfo);
    }
  }

  /**
   * Focuses the element via the specified focus origin.
   * @param element Element to focus.
   * @param origin Focus origin.
   * @param options Options that can be used to configure the focus behavior.
   * 通過指定的焦點原點對元素進行聚焦。
   * @param element要聚焦的元素。
   * @param origin聚焦原點。
   * @param選項可用於配置焦點行為的選項。
   */
  focusVia(element: HTMLElement, origin: FocusOrigin, options?: FocusOptions): void;

  /**
   * Focuses the element via the specified focus origin.
   * @param element Element to focus.
   * @param origin Focus origin.
   * @param options Options that can be used to configure the focus behavior.
   * 通過指定的焦點原點對元素進行聚焦。
   * @param element要聚焦的元素。
   * @param origin聚焦原點。
   * @param選項可用於配置焦點行為的選項。
   */
  focusVia(element: ElementRef<HTMLElement>, origin: FocusOrigin, options?: FocusOptions): void;

  focusVia(element: HTMLElement | ElementRef<HTMLElement>,
    origin: FocusOrigin,
    options?: FocusOptions): void {

    const nativeElement = coerceElement(element);
    const focusedElement = this._getDocument().activeElement;

    // If the element is focused already, calling `focus` again won't trigger the event listener
    // which means that the focus classes won't be updated. If that's the case, update the classes
    // directly without waiting for an event.
    // 如果元素已經聚焦，則再次調用`focus`不會觸發事件監聽器
    // ，這意味著焦點類不會被更新。如果是這樣，請直接更新類別
    // 而無需等待事件。
    if (nativeElement === focusedElement) {
      this._getClosestElementsInfo(nativeElement)
        .forEach(([currentElement, info]) => this._originChanged(currentElement, origin, info));
    } else {
      this._setOriginForCurrentEventQueue(origin);

      // `focus` isn't available on the server
      //`focus`在server上不可用
      if (typeof nativeElement.focus === 'function') {
        nativeElement.focus(options);
      }
    }
  }

  ngOnDestroy() {
    this._elementInfo.forEach((_info, element) => this.stopMonitoring(element));
  }

  /** Access injected document if available or fallback to global document reference */
  // 訪問已註入的文檔（如果可用）或回退到全局文檔參考
  private _getDocument(): Document {
    return this._document || document;
  }

  /** Use defaultView of injected document if available or fallback to global window reference */
  // 使用注入文件的defaultView（如果可用）或回退到全局窗口參考
  private _getWindow(): Window {
    const doc = this._getDocument();
    return doc.defaultView || window;
  }

  private _toggleClass(element: Element, className: string, shouldSet: boolean) {
    if (shouldSet) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }

  private _getFocusOrigin(event: FocusEvent): FocusOrigin {
    // If we couldn't detect a cause for the focus event, it's due to one of three reasons:
    // 1) The window has just regained focus, in which case we want to restore the focused state of
    //    the element from before the window blurred.
    // 2) It was caused by a touch event, in which case we mark the origin as 'touch'.
    // 3) The element was programmatically focused, in which case we should mark the origin as
    //    'program'.
    // 如果無法檢測到焦點事件的原因，則歸因於以下三個原因之一：
    // 1）窗口剛剛重新獲得焦點，在這種情況下，我們想恢復焦點
    // 窗口模糊之前的元素。
    // 2）這是由觸摸事件引起的，在這種情況下，我們將原點標記為“觸摸”。
    // 3）該元素以編程方式集中，在這種情況下，我們應將原點標記為
    //    '程序'。
    if (this._origin) {
      return this._origin;
    }

    if (this._windowFocused && this._lastFocusOrigin) {
      return this._lastFocusOrigin;
    } else if (this._wasCausedByTouch(event)) {
      return 'touch';
    } else {
      return 'program';
    }
  }

  /**
   * Sets the focus classes on the element based on the given focus origin.
   * @param element The element to update the classes on.
   * @param origin The focus origin.
   * 根據給定的焦點原點在元素上設置焦點類。
   * @param元素用於更新類的元素。
   * @param origin焦點來源。
   */
  private _setClasses(element: HTMLElement, origin?: FocusOrigin): void {
    this._toggleClass(element, 'cdk-focused', !!origin);
    this._toggleClass(element, 'cdk-touch-focused', origin === 'touch');
    this._toggleClass(element, 'cdk-keyboard-focused', origin === 'keyboard');
    this._toggleClass(element, 'cdk-mouse-focused', origin === 'mouse');
    this._toggleClass(element, 'cdk-program-focused', origin === 'program');
  }

  /**
   * Sets the origin and schedules an async function to clear it at the end of the event queue.
   * If the detection mode is 'eventual', the origin is never cleared.
   * @param origin The origin to set.
   * 設置原點並安排異步功能以在事件隊列末尾將其清除。
   * 如果檢測模式為“最終”，則永遠不會清除原點。
   * @param origin要設置的原點。
   */
  private _setOriginForCurrentEventQueue(origin: FocusOrigin): void {
    this._ngZone.runOutsideAngular(() => {
      this._origin = origin;

      if (this._detectionMode === FocusMonitorDetectionMode.IMMEDIATE) {
        // Sometimes the focus origin won't be valid in Firefox because Firefox seems to focus *one*
        // tick after the interaction event fired. To ensure the focus origin is always correct,
        // the focus origin will be determined at the beginning of the next tick.
        // 有時焦點原點在Firefox中無效，因為Firefox似乎會*集中*
        // 觸發互動事件後打勾。為確保焦點原點始終正確，
        // 焦點原點將在下一個刻度線的開始處確定。
        this._originTimeoutId = setTimeout(() => this._origin = null, 1);
      }
    });
  }

  /**
   * Checks whether the given focus event was caused by a touchstart event.
   * @param event The focus event to check.
   * @returns Whether the event was caused by a touch.
   * 檢查給定的焦點事件是否由touchstart事件引起。
   * @param event要檢查的焦點事件。
   * @returns事件是否是由觸摸引起的。
   */
  private _wasCausedByTouch(event: FocusEvent): boolean {
    // Note(mmalerba): This implementation is not quite perfect, there is a small edge case.
    // Consider the following dom structure:
    //
    // <div #parent tabindex="0" cdkFocusClasses>
    //   <div #child (click)="#parent.focus()"></div>
    // </div>
    //
    // If the user touches the #child element and the #parent is programmatically focused as a
    // result, this code will still consider it to have been caused by the touch event and will
    // apply the cdk-touch-focused class rather than the cdk-program-focused class. This is a
    // relatively small edge-case that can be worked around by using
    // focusVia(parentEl, 'program') to focus the parent element.
    //
    // If we decide that we absolutely must handle this case correctly, we can do so by listening
    // for the first focus event after the touchstart, and then the first blur event after that
    // focus event. When that blur event fires we know that whatever follows is not a result of the
    // touchstart.

    // 筆記（mmalerba）：這個實現不是很完美，邊緣情況很小。
    //考慮以下dom結構：
    //
    // <div #parent tabindex =“ 0” cdkFocusClasses>
    // <div #child（click）=“＃parent.focus（）”> </ div>
    // </ div>
    //
    //如果用戶觸摸#child元素，並且#parent通過編程方式集中為
    //結果，此代碼仍會認為它是由touch事件引起的，並且會
    //應用cdk-touch-focused類，而不是cdk-program-focused類。這是一個
    //相對較小的邊緣情況，可以通過使用來解決
    // focusVia（parentEl，'program'）聚焦父元素。
    //
    //如果我們決定絕對必須正確處理此情況，則可以通過偵聽來實現
    //對於touchstart之後的第一個焦點事件，然後是之後的第一個模糊事件
    //焦點事件。當該模糊事件觸發時，我們知道接下來發生的一切都不是由於
    const focusTarget = getTarget(event);
    return this._lastTouchTarget instanceof Node && focusTarget instanceof Node &&
      (focusTarget === this._lastTouchTarget || focusTarget.contains(this._lastTouchTarget));
  }

  /**
   * Handles focus events on a registered element.
   * @param event The focus event.
   * @param element The monitored element.
   * 處理焦點事件在已註冊的元素上。
   * @param event焦點事件。
   * @param元素受監視的元素。
   */
  private _onFocus(event: FocusEvent, element: HTMLElement) {
    // NOTE(mmalerba): We currently set the classes based on the focus origin of the most recent
    // focus event affecting the monitored element. If we want to use the origin of the first event
    // instead we should check for the cdk-focused class here and return if the element already has
    // it. (This only matters for elements that have includesChildren = true).

    // If we are not counting child-element-focus as focused, make sure that the event target is the
    // monitored element itself.
    // NOTE（mmalerba）：我們目前根據最新焦點的來源來設置類
    //焦點事件影響受監視的元素。如果我們想使用第一個事件的起源
    //相反，我們應該在此處檢查cdk-focused類，並返回該元素是否已經具有
    // 它。 （這僅對具有includeChildren = true的元素有效）。

    //如果我們不將關注子元素的關注點歸為關注點，請確保事件目標為
    //監視元素本身。
    const elementInfo = this._elementInfo.get(element);
    if (!elementInfo || (!elementInfo.checkChildren && element !== getTarget(event))) {
      return;
    }

    this._originChanged(element, this._getFocusOrigin(event), elementInfo);
  }

  /**
   * Handles blur events on a registered element.
   * @param event The blur event.
   * @param element The monitored element.
   * 處理已註冊元素上的模糊事件。
   * @param事件模糊事件。
   * @param元素受監視的元素。
   */
  _onBlur(event: FocusEvent, element: HTMLElement) {
    // If we are counting child-element-focus as focused, make sure that we aren't just blurring in
    // order to focus another child of the monitored element.
    // 如果我們以關注子元素為重點，請確保我們不僅僅是在模糊
    // 為了集中監視元素的另一個子元素。
    const elementInfo = this._elementInfo.get(element);

    if (!elementInfo || (elementInfo.checkChildren && event.relatedTarget instanceof Node &&
      element.contains(event.relatedTarget))) {
      return;
    }

    this._setClasses(element);
    this._emitOrigin(elementInfo.subject, null);
  }

  private _emitOrigin(subject: Subject<FocusOrigin>, origin: FocusOrigin) {
    this._ngZone.run(() => subject.next(origin));
  }

  private _registerGlobalListeners(elementInfo: MonitoredElementInfo) {
    // 判斷是不是在瀏覽器
    if (!this._platform.isBrowser) {
      return;
    }

    const rootNode = elementInfo.rootNode;
    const rootNodeFocusListeners = this._rootNodeFocusListenerCount.get(rootNode) || 0;

    if (!rootNodeFocusListeners) {
      this._ngZone.runOutsideAngular(() => {
        rootNode.addEventListener('focus', this._rootNodeFocusAndBlurListener,
          captureEventListenerOptions);
        rootNode.addEventListener('blur', this._rootNodeFocusAndBlurListener,
          captureEventListenerOptions);
      });
    }

    this._rootNodeFocusListenerCount.set(rootNode, rootNodeFocusListeners + 1);

    // Register global listeners when first element is monitored.
    // 在監視第一個元素時註冊全局偵聽器。
    if (++this._monitoredElementCount === 1) {
      // Note: we listen to events in the capture phase so we
      // can detect them even if the user stops propagation.
      // 注意：我們在捕獲階段監聽事件，因此我們
      // 即使用戶停止傳播也可以檢測到它們。
      this._ngZone.runOutsideAngular(() => {
        const document = this._getDocument();
        const window = this._getWindow();

        document.addEventListener('keydown', this._documentKeydownListener,
          captureEventListenerOptions);
        document.addEventListener('mousedown', this._documentMousedownListener,
          captureEventListenerOptions);
        document.addEventListener('touchstart', this._documentTouchstartListener,
          captureEventListenerOptions);
        window.addEventListener('focus', this._windowFocusListener);
      });
    }
  }

  private _removeGlobalListeners(elementInfo: MonitoredElementInfo) {
    const rootNode = elementInfo.rootNode;

    if (this._rootNodeFocusListenerCount.has(rootNode)) {
      const rootNodeFocusListeners = this._rootNodeFocusListenerCount.get(rootNode)!;

      if (rootNodeFocusListeners > 1) {
        this._rootNodeFocusListenerCount.set(rootNode, rootNodeFocusListeners - 1);
      } else {
        rootNode.removeEventListener('focus', this._rootNodeFocusAndBlurListener,
          captureEventListenerOptions);
        rootNode.removeEventListener('blur', this._rootNodeFocusAndBlurListener,
          captureEventListenerOptions);
        this._rootNodeFocusListenerCount.delete(rootNode);
      }
    }

    // Unregister global listeners when last element is unmonitored.
    // 取消監視最後一個元素時註銷全局偵聽器。
    if (!--this._monitoredElementCount) {
      const document = this._getDocument();
      const window = this._getWindow();

      document.removeEventListener('keydown', this._documentKeydownListener,
        captureEventListenerOptions);
      document.removeEventListener('mousedown', this._documentMousedownListener,
        captureEventListenerOptions);
      document.removeEventListener('touchstart', this._documentTouchstartListener,
        captureEventListenerOptions);
      window.removeEventListener('focus', this._windowFocusListener);

      // Clear timeouts for all potentially pending timeouts to prevent the leaks.
      // 為所有潛在的未決超時清除超時，以防止洩漏。
      clearTimeout(this._windowFocusTimeoutId);
      clearTimeout(this._touchTimeoutId);
      clearTimeout(this._originTimeoutId);
    }
  }

  /** Updates all the state on an element once its focus origin has changed. */
  /** 更改焦點原點後，更新元素上的所有狀態。 */
  private _originChanged(element: HTMLElement, origin: FocusOrigin,
    elementInfo: MonitoredElementInfo) {
    this._setClasses(element, origin);
    this._emitOrigin(elementInfo.subject, origin);
    this._lastFocusOrigin = origin;
  }

  /**
   * Collects the `MonitoredElementInfo` of a particular element and
   * all of its ancestors that have enabled `checkChildren`.
   * @param element Element from which to start the search.
   * 收集特定元素的“ MonitoredElementInfo”，並
   * 所有啟用`checkChildren`的祖先。
   * @param element 從中開始搜索的元素。
   */
  private _getClosestElementsInfo(element: HTMLElement): [HTMLElement, MonitoredElementInfo][] {
    const results: [HTMLElement, MonitoredElementInfo][] = [];

    this._elementInfo.forEach((info, currentElement) => {
      if (currentElement === element || (info.checkChildren && currentElement.contains(element))) {
        results.push([currentElement, info]);
      }
    });

    return results;
  }
}

/** Gets the target of an event, accounting for Shadow DOM. */
// 獲取事件的目標，說明Shadow DOM。
// 參考 https://developer.mozilla.org/zh-CN/docs/Web/Web_Components/Using_shadow_DOM
function getTarget(event: Event): HTMLElement | null {
  // If an event is bound outside the Shadow DOM, the `event.target` will
  // point to the shadow root so we have to use `composedPath` instead.
  // 如果事件綁定在Shadow DOM之外，則`event.target`將
  // 指向shadowRoot，因此我們必須改用`composedPath`。
  // 參考 https://developer.mozilla.org/zh-CN/docs/Web/API/Event/composedPath
  return (event.composedPath ? event.composedPath()[0] : event.target) as HTMLElement | null;
}


/**
 * Directive that determines how a particular element was focused (via keyboard, mouse, touch, or
 * programmatically) and adds corresponding classes to the element.
 *
 * There are two variants of this directive:
 * 1) cdkMonitorElementFocus: does not consider an element to be focused if one of its children is
 *    focused.
 * 2) cdkMonitorSubtreeFocus: considers an element focused if it or any of its children are focused.
 * 指令，用於確定特定元素的聚焦方式（通過鍵盤，鼠標，觸摸或
 * 以編程方式），並向該元素添加相應的類。
 *
 * 該指令有兩種變體：
 * 1）cdkMonitorElementFocus：如果某個元素的子元素是被focus
 * 
 * 2）cdkMonitorSubtreeFocus：如果某個元素或其任何子元素均已聚焦，則認為該元素已聚焦。
 */
@Directive({
  selector: '[cdkMonitorElementFocus], [cdkMonitorSubtreeFocus]',
})
export class CdkMonitorFocus implements AfterViewInit, OnDestroy {
  private _monitorSubscription: Subscription;
  @Output() cdkFocusChange = new EventEmitter<FocusOrigin>();

  constructor(private _elementRef: ElementRef<HTMLElement>, private _focusMonitor: FocusMonitor) { }

  ngAfterViewInit() {
    const element = this._elementRef.nativeElement;
    this._monitorSubscription = this._focusMonitor.monitor(
      element,
      element.nodeType === 1 && element.hasAttribute('cdkMonitorSubtreeFocus'))
      .subscribe(origin => this.cdkFocusChange.emit(origin));
  }

  ngOnDestroy() {
    this._focusMonitor.stopMonitoring(this._elementRef);

    if (this._monitorSubscription) {
      this._monitorSubscription.unsubscribe();
    }
  }
}
