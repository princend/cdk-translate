/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ContentObserver} from '@angular/cdk/observers';
import {DOCUMENT} from '@angular/common';
import {
  Directive,
  ElementRef,
  Inject,
  Injectable,
  Input,
  NgZone,
  OnDestroy,
  Optional,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {
  AriaLivePoliteness,
  LiveAnnouncerDefaultOptions,
  LIVE_ANNOUNCER_ELEMENT_TOKEN,
  LIVE_ANNOUNCER_DEFAULT_OPTIONS,
} from './live-announcer-tokens';


@Injectable({providedIn: 'root'})
export class LiveAnnouncer implements OnDestroy {
  private _liveElement: HTMLElement;
  private _document: Document;
  private _previousTimeout?: number;

  constructor(
      @Optional() @Inject(LIVE_ANNOUNCER_ELEMENT_TOKEN) elementToken: any,
      private _ngZone: NgZone,
      @Inject(DOCUMENT) _document: any,
      @Optional() @Inject(LIVE_ANNOUNCER_DEFAULT_OPTIONS)
      private _defaultOptions?: LiveAnnouncerDefaultOptions) {

    // We inject the live element and document as `any` because the constructor signature cannot
    // reference browser globals (HTMLElement, Document) on non-browser environments, since having
    // a class decorator causes TypeScript to preserve the constructor signature types.
    //我們將live元素和文檔注入為any，因為構造函數簽名無法
    //在非瀏覽器環境中引用瀏覽器全局變量（HTMLElement，Document），因為
    //類裝飾器使TypeScript保留構造函數的簽名類型。
    this._document = _document;
    this._liveElement = elementToken || this._createLiveElement();
  }

  /**
   * Announces a message to screenreaders.
   * @param message Message to be announced to the screenreader.
   * @returns Promise that will be resolved when the message is added to the DOM.
   * *向屏幕閱讀器發布一條消息。
   * @param message消息將通知屏幕閱讀器。
   * @returns將消息添加到DOM時將解決的Promise。
   */
  announce(message: string): Promise<void>;

  /**
   * Announces a message to screenreaders.
   * @param message Message to be announced to the screenreader.
   * @param politeness The politeness of the announcer element.
   * @returns Promise that will be resolved when the message is added to the DOM.
   * 向屏幕閱讀器發布一條消息。
   * @param message消息將通知屏幕閱讀器。
   * @param politeness播音員元素的禮貌。
   * @returns將消息添加到DOM時將解決的Promise。
   */
  announce(message: string, politeness?: AriaLivePoliteness): Promise<void>;

  /**
   * Announces a message to screenreaders.
   * @param message Message to be announced to the screenreader.
   * @param duration Time in milliseconds after which to clear out the announcer element. Note
   *   that this takes effect after the message has been added to the DOM, which can be up to
   *   100ms after `announce` has been called.
   * @returns Promise that will be resolved when the message is added to the DOM.
   * 向屏幕閱讀器發布一條消息。
   * @param message消息將通知屏幕閱讀器。
   * @param duration清除播音員元素的時間（以毫秒為單位）。筆記
   * 在將郵件添加到DOM後，此操作才生效，最多可以達到
   * 調用`announce`後的100毫秒。
   * @returns將消息添加到DOM時將解決的Promise。
   */
  announce(message: string, duration?: number): Promise<void>;

  /**
   * Announces a message to screenreaders.
   * @param message Message to be announced to the screenreader.
   * @param politeness The politeness of the announcer element.
   * @param duration Time in milliseconds after which to clear out the announcer element. Note
   *   that this takes effect after the message has been added to the DOM, which can be up to
   *   100ms after `announce` has been called.
   * @returns Promise that will be resolved when the message is added to the DOM.
   * 向屏幕閱讀器發布一條消息。
   * @param message消息將通知屏幕閱讀器。
   * @param politeness播音員元素的禮貌。
   * @param duration清除播音員元素的時間（以毫秒為單位）。筆記
   * 在將郵件添加到DOM後，此操作才生效，最多可以達到
   * 調用`announce`後的100毫秒。
   * @returns將消息添加到DOM時將解決的Promise。
   */
  announce(message: string, politeness?: AriaLivePoliteness, duration?: number): Promise<void>;

  announce(message: string, ...args: any[]): Promise<void> {
    const defaultOptions = this._defaultOptions;
    let politeness: AriaLivePoliteness | undefined;
    let duration: number | undefined;

    if (args.length === 1 && typeof args[0] === 'number') {
      duration = args[0];
    } else {
      [politeness, duration] = args;
    }

    this.clear();
    clearTimeout(this._previousTimeout);

    if (!politeness) {
      politeness =
          (defaultOptions && defaultOptions.politeness) ? defaultOptions.politeness : 'polite';
    }

    if (duration == null && defaultOptions) {
      duration = defaultOptions.duration;
    }

    // TODO: ensure changing the politeness works on all environments we support.
    // TODO：確保禮貌在我們支持的所有環境中均有效。
    this._liveElement.setAttribute('aria-live', politeness);

    // This 100ms timeout is necessary for some browser + screen-reader combinations:
    // - Both JAWS and NVDA over IE11 will not announce anything without a non-zero timeout.
    // - With Chrome and IE11 with NVDA or JAWS, a repeated (identical) message won't be read a
    //   second time without clearing and then using a non-zero delay.
    // (using JAWS 17 at time of this writing).
    //對於某些瀏覽器+屏幕閱讀器組合，此100ms超時是必需的：
    //-IE11上的JAWS和NVDA都不會在沒有非零超時的情況下宣布任何內容。
    //-使用帶有NVDA或JAWS的Chrome和IE11，將不會讀取重複的（相同的）消息，
    //第二次不清除，然後使用非零延遲。
    //（在撰寫本文時使用JAWS 17）。
    return this._ngZone.runOutsideAngular(() => {
      return new Promise(resolve => {
        clearTimeout(this._previousTimeout);
        this._previousTimeout = setTimeout(() => {
          this._liveElement.textContent = message;
          resolve();

          if (typeof duration === 'number') {
            this._previousTimeout = setTimeout(() => this.clear(), duration);
          }
        }, 100);
      });
    });
  }

  /**
   * Clears the current text from the announcer element. Can be used to prevent
   * screen readers from reading the text out again while the user is going
   * through the page landmarks.
   * 從播音員元素中清除當前文本。可以用來預防
   *屏幕閱讀器在用戶前進時不會再次朗讀文本
   *通過頁面地標。
   */
  clear() {
    if (this._liveElement) {
      this._liveElement.textContent = '';
    }
  }

  ngOnDestroy() {
    clearTimeout(this._previousTimeout);

    if (this._liveElement && this._liveElement.parentNode) {
      this._liveElement.parentNode.removeChild(this._liveElement);
      this._liveElement = null!;
    }
  }

  private _createLiveElement(): HTMLElement {
    const elementClass = 'cdk-live-announcer-element';
    const previousElements = this._document.getElementsByClassName(elementClass);
    const liveEl = this._document.createElement('div');

    // Remove any old containers. This can happen when coming in from a server-side-rendered page.
    // 取出所有舊容器。從服務器端渲染的頁面進入時可能會發生這種情況。
    for (let i = 0; i < previousElements.length; i++) {
      previousElements[i].parentNode!.removeChild(previousElements[i]);
    }

    liveEl.classList.add(elementClass);
    liveEl.classList.add('cdk-visually-hidden');

    // 參考 https://developers.google.com/web/fundamentals/accessibility/semantics-aria/hiding-and-updating-content?hl=zh-tw
    liveEl.setAttribute('aria-atomic', 'true');
    liveEl.setAttribute('aria-live', 'polite');

    this._document.body.appendChild(liveEl);

    return liveEl;
  }

}


/**
 * A directive that works similarly to aria-live, but uses the LiveAnnouncer to ensure compatibility
 * with a wider range of browsers and screen readers.
 * 指令與aria-live相似，但使用LiveAnnouncer來確保兼容性
 * 具有更廣泛的瀏覽器和屏幕閱讀器。
 */
@Directive({
  selector: '[cdkAriaLive]',
  exportAs: 'cdkAriaLive',
})
export class CdkAriaLive implements OnDestroy {
  /** The aria-live politeness level to use when announcing messages.
   * 宣布消息時要使用的 politeness level 。
   */
  @Input('cdkAriaLive')
  get politeness(): AriaLivePoliteness { return this._politeness; }
  set politeness(value: AriaLivePoliteness) {
    this._politeness = value === 'off' || value === 'assertive' ? value : 'polite';
    if (this._politeness === 'off') {
      if (this._subscription) {
        this._subscription.unsubscribe();
        this._subscription = null;
      }
    } else if (!this._subscription) {
      this._subscription = this._ngZone.runOutsideAngular(() => {
        return this._contentObserver
          .observe(this._elementRef)
          .subscribe(() => {
            // Note that we use textContent here, rather than innerText, in order to avoid a reflow.
            // 注意，為了避免重排，我們在這裡使用textContent而不是innerText。
            // 參考 https://medium.com/schaoss-blog/前端三十-03-css-reflow-及-repaint-是什麼-36293ebcffe7
            const elementText = this._elementRef.nativeElement.textContent;

            // The `MutationObserver` fires also for attribute
            // changes which we don't want to announce.
            //屬性也會觸發`MutationObserver`的更改
            //我們不想announce。
            if (elementText !== this._previousAnnouncedText) {
              this._liveAnnouncer.announce(elementText, this._politeness);
              this._previousAnnouncedText = elementText;
            }
          });
      });
    }
  }
  private _politeness: AriaLivePoliteness = 'polite';

  private _previousAnnouncedText?: string;
  private _subscription: Subscription | null;

  constructor(private _elementRef: ElementRef, private _liveAnnouncer: LiveAnnouncer,
              private _contentObserver: ContentObserver, private _ngZone: NgZone) {}

  ngOnDestroy() {
    if (this._subscription) {
      this._subscription.unsubscribe();
    }
  }
}
