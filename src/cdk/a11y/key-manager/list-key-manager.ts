/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { QueryList } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  UP_ARROW,
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  TAB,
  A,
  Z,
  ZERO,
  NINE,
  hasModifierKey,
  HOME,
  END,
} from '@angular/cdk/keycodes';
import { debounceTime, filter, map, tap } from 'rxjs/operators';

/** This interface is for items that can be passed to a ListKeyManager.
 * 此接口用於可傳遞給ListKeyManager的項目。
 */
export interface ListKeyManagerOption {
  /** Whether the option is disabled.
   * 該選項是否被禁用。
   */
  disabled?: boolean;

  /** Gets the label for this option.
   * 獲取此選項的標籤。
   */
  getLabel?(): string;
}

/** Modifier keys handled by the ListKeyManager. 
 * ListKeyManager處理的修飾鍵。
*/
export type ListKeyManagerModifierKey = 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';

/**
 * This class manages keyboard events for selectable lists. If you pass it a query list
 * of items, it will set the active item correctly when arrow events occur.
 * 此類管理可選列表的鍵盤事件。如果您將其傳遞給查詢列表
 * 項，它將在發生箭頭事件時正確設置活動項。
 */
export class ListKeyManager<T extends ListKeyManagerOption> {
  private _activeItemIndex = -1;
  private _activeItem: T | null = null;
  private _wrap = false;
  private _letterKeyStream = new Subject<string>();
  private _typeaheadSubscription = Subscription.EMPTY;
  private _vertical = true;
  private _horizontal: 'ltr' | 'rtl' | null;
  private _allowedModifierKeys: ListKeyManagerModifierKey[] = [];
  private _homeAndEnd = false;

  /**
   * Predicate function that can be used to check whether an item should be skipped
   * by the key manager. By default, disabled items are skipped.
   * Predicate function，可用於檢查是否應跳過某項
   * 由密鑰管理員提供。默認情況下，禁用的項目被跳過。
   */
  private _skipPredicateFn = (item: T) => item.disabled;

  // Buffer for the letters that the user has pressed when the typeahead option is turned on.
  // 打開預輸入選項時用戶按下的字母的緩衝區。
  private _pressedLetters: string[] = [];

  constructor(private _items: QueryList<T> | T[]) {
    // We allow for the items to be an array because, in some cases, the consumer may
    // not have access to a QueryList of the items they want to manage (e.g. when the
    // items aren't being collected via `ViewChildren` or `ContentChildren`).
    // 我們允許items為array，因為在某些情況下，消費者可能
    // 無法訪問他們要管理的項目的QueryList（例如，當
    // 不會通過`ViewChildren`或`ContentChildren`來收集項目。
    if (_items instanceof QueryList) {
      _items.changes.subscribe((newItems: QueryList<T>) => {
        if (this._activeItem) {
          const itemArray = newItems.toArray();
          const newIndex = itemArray.indexOf(this._activeItem);

          if (newIndex > -1 && newIndex !== this._activeItemIndex) {
            this._activeItemIndex = newIndex;
          }
        }
      });
    }
  }

  /**
   * Stream that emits any time the TAB key is pressed, so components can react
   * when focus is shifted off of the list.
   * 只要按下TAB鍵，Stream就會發出，因此組件可以做出反應
   * 當焦點從列表移開時。
   */
  tabOut: Subject<void> = new Subject<void>();

  /** Stream that emits whenever the active item of the list manager changes. 
   * 每當列表管理器的活動項目更改時發出的流。
  */
  change = new Subject<number>();

  /**
   * Sets the predicate function that determines which items should be skipped by the
   * list key manager.
   * @param predicate Function that determines whether the given item should be skipped.
   * 設置謂詞函數，該函數確定哪些項應被跳過
   * 列出key manager。
   * @param謂詞函數，用於確定是否應跳過給定的項目。
   * 
   * 參考 https://www.freecodecamp.org/news/discover-functional-programming-in-javascript-with-this-thorough-introduction-a2ad9af2d645/
   */
  skipPredicate(predicate: (item: T) => boolean): this {
    this._skipPredicateFn = predicate;
    return this;
  }

  /**
   * Configures wrapping mode, which determines whether the active item will wrap to
   * the other end of list when there are no more items in the given direction.
   * @param shouldWrap Whether the list should wrap when reaching the end.
   * 配置包裝模式，該模式確定活動項目是否將包裝到
   * 在給定方向上沒有更多項目時，列表的另一端。
   * @param shouldWrap到達末尾時是否應該包裝列表。
   */
  withWrap(shouldWrap = true): this {
    this._wrap = shouldWrap;
    return this;
  }

  /**
   * Configures whether the key manager should be able to move the selection vertically.
   * @param enabled Whether vertical selection should be enabled.
   * 配置密鑰管理器是否應該能夠垂直移動選擇。
   * @param enabled是否應啟用垂直選擇。
   */
  withVerticalOrientation(enabled: boolean = true): this {
    this._vertical = enabled;
    return this;
  }

  /**
   * Configures the key manager to move the selection horizontally.
   * Passing in `null` will disable horizontal movement.
   * @param direction Direction in which the selection can be moved.
   * 配置密鑰管理器以水平移動選擇。
   * 傳遞“ null”將禁用水平移動。
   * @param direction可以移動選擇的方向。
   */
  withHorizontalOrientation(direction: 'ltr' | 'rtl' | null): this {
    this._horizontal = direction;
    return this;
  }

  /**
   * Modifier keys which are allowed to be held down and whose default actions will be prevented
   * as the user is pressing the arrow keys. Defaults to not allowing any modifier keys.
   * 允許按住修改鍵並防止其默認操作的修改鍵
   * 當用戶按下箭頭鍵時。默認為不允許任何修飾鍵。
   */
  withAllowedModifierKeys(keys: ListKeyManagerModifierKey[]): this {
    this._allowedModifierKeys = keys;
    return this;
  }

  /**
   * Turns on typeahead mode which allows users to set the active item by typing.
   * @param debounceInterval Time to wait after the last keystroke before setting the active item.
   * 打開預輸入模式，該模式允許用戶通過鍵入來設置活動項目。
   * @param debounceInterval上一次按鍵後等待的時間，然後再設置活動項目。
   */
  withTypeAhead(debounceInterval: number = 200): this {
    if ((typeof ngDevMode === 'undefined' || ngDevMode) && (this._items.length &&
      this._items.some(item => typeof item.getLabel !== 'function'))) {
      throw Error('ListKeyManager items in typeahead mode must implement the `getLabel` method.');
    }

    this._typeaheadSubscription.unsubscribe();

    // Debounce the presses of non-navigational keys, collect the ones that correspond to letters
    // and convert those letters back into a string. Afterwards find the first item that starts
    // with that string and select it.
    //消除非導航鍵的按下，收集與字母相對應的按鍵
    //然後將這些字母轉換回字符串。然後找到開始的第一個項目
    //並選擇該字符串。
    this._typeaheadSubscription = this._letterKeyStream.pipe(
      tap(letter => this._pressedLetters.push(letter)),
      debounceTime(debounceInterval),
      filter(() => this._pressedLetters.length > 0),
      map(() => this._pressedLetters.join(''))
    ).subscribe(inputString => {
      const items = this._getItemsArray();

      // Start at 1 because we want to start searching at the item immediately
      // following the current active item.
      //從1開始，因為我們要立即開始搜索該項目
      //在當前活動項目之後。
      for (let i = 1; i < items.length + 1; i++) {
        const index = (this._activeItemIndex + i) % items.length;
        const item = items[index];

        if (!this._skipPredicateFn(item) &&
          item.getLabel!().toUpperCase().trim().indexOf(inputString) === 0) {

          this.setActiveItem(index);
          break;
        }
      }

      this._pressedLetters = [];
    });

    return this;
  }

  /**
   * Configures the key manager to activate the first and last items
   * respectively when the Home or End key is pressed.
   * @param enabled Whether pressing the Home or End key activates the first/last item.
   * 配置密鑰管理器以激活第一個和最後一個項目
   * 分別按Home鍵或End鍵時。
   * 已啟用@param按下Home或End鍵激活第一項/最後一項。
   */
  withHomeAndEnd(enabled: boolean = true): this {
    this._homeAndEnd = enabled;
    return this;
  }

  /**
   * Sets the active item to the item at the index specified.
   * @param index The index of the item to be set as active.
   * 將活動項目設置為指定索引處的項目。
   * @param index要設置為活動的項目的索引。
   */
  setActiveItem(index: number): void;

  /**
   * Sets the active item to the specified item.
   * @param item The item to be set as active.
   * *將活動項目設置為指定項目。
   * @param項目要設置為活動的項目。
   */
  setActiveItem(item: T): void;

  setActiveItem(item: any): void {
    const previousActiveItem = this._activeItem;

    this.updateActiveItem(item);

    if (this._activeItem !== previousActiveItem) {
      this.change.next(this._activeItemIndex);
    }
  }

  /**
   * Sets the active item depending on the key event passed in.
   * @param event Keyboard event to be used for determining which element should be active.
   * 根據傳入的鍵事件設置活動項。
   * @param事件用於確定哪個元素應處於活動狀態的鍵盤事件。
   */
  onKeydown(event: KeyboardEvent): void {
    const keyCode = event.keyCode;
    const modifiers: ListKeyManagerModifierKey[] = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];
    const isModifierAllowed = modifiers.every(modifier => {
      return !event[modifier] || this._allowedModifierKeys.indexOf(modifier) > -1;
    });

    switch (keyCode) {
      case TAB:
        this.tabOut.next();
        return;

      case DOWN_ARROW:
        if (this._vertical && isModifierAllowed) {
          this.setNextItemActive();
          break;
        } else {
          return;
        }

      case UP_ARROW:
        if (this._vertical && isModifierAllowed) {
          this.setPreviousItemActive();
          break;
        } else {
          return;
        }

      case RIGHT_ARROW:
        if (this._horizontal && isModifierAllowed) {
          this._horizontal === 'rtl' ? this.setPreviousItemActive() : this.setNextItemActive();
          break;
        } else {
          return;
        }

      case LEFT_ARROW:
        if (this._horizontal && isModifierAllowed) {
          this._horizontal === 'rtl' ? this.setNextItemActive() : this.setPreviousItemActive();
          break;
        } else {
          return;
        }

      case HOME:
        if (this._homeAndEnd && isModifierAllowed) {
          this.setFirstItemActive();
          break;
        } else {
          return;
        }

      case END:
        if (this._homeAndEnd && isModifierAllowed) {
          this.setLastItemActive();
          break;
        } else {
          return;
        }

      default:
        if (isModifierAllowed || hasModifierKey(event, 'shiftKey')) {
          // Attempt to use the `event.key` which also maps it to the user's keyboard language,
          // otherwise fall back to resolving alphanumeric characters via the keyCode.
          //嘗試使用“ event.key”，該事件也會將其映射到用戶的鍵盤語言，
          //否則會通過keyCode解析為字母數字字符。
          if (event.key && event.key.length === 1) {
            this._letterKeyStream.next(event.key.toLocaleUpperCase());
          } else if ((keyCode >= A && keyCode <= Z) || (keyCode >= ZERO && keyCode <= NINE)) {
            this._letterKeyStream.next(String.fromCharCode(keyCode));
          }
        }

        // Note that we return here, in order to avoid preventing
        // the default action of non-navigational keys.
        //請注意，我們返回此處是為了避免
        //非導航鍵的默認操作。
        return;
    }

    this._pressedLetters = [];
    event.preventDefault();
  }

  /** Index of the currently active item.
   * 當前活動項目的索引
   */
  get activeItemIndex(): number | null {
    return this._activeItemIndex;
  }

  /** The active item.
   * 活動項目。
   */
  get activeItem(): T | null {
    return this._activeItem;
  }

  /** Gets whether the user is currently typing into the manager using the typeahead feature. 
   * 獲取用戶當前是否正在使用預輸入功能輸入管理員。
  */
  isTyping(): boolean {
    return this._pressedLetters.length > 0;
  }

  /** Sets the active item to the first enabled item in the list.
   * 將活動項目設置為列表中第一個啟用的項目。
   */
  setFirstItemActive(): void {
    this._setActiveItemByIndex(0, 1);
  }

  /** Sets the active item to the last enabled item in the list. 
   * 將活動項目設置為列表中最後一個啟用的項目。
  */
  setLastItemActive(): void {
    this._setActiveItemByIndex(this._items.length - 1, -1);
  }

  /** Sets the active item to the next enabled item in the list.
   * 將活動項目設置為列表中的下一個啟用的項目。
   */
  setNextItemActive(): void {
    this._activeItemIndex < 0 ? this.setFirstItemActive() : this._setActiveItemByDelta(1);
  }

  /** Sets the active item to a previous enabled item in the list. 
   * 將活動項目設置為列表中先前啟用的項目。
  */
  setPreviousItemActive(): void {
    this._activeItemIndex < 0 && this._wrap ? this.setLastItemActive()
      : this._setActiveItemByDelta(-1);
  }

  /**
   * Allows setting the active without any other effects.
   * @param index Index of the item to be set as active.
   * 允許在沒有任何其他效果的情況下設置活動。
   * @param index要設置為活動的項目的索引。
   */
  updateActiveItem(index: number): void;

  /**
   * Allows setting the active item without any other effects.
   * @param item Item to be set as active.
   * 允許設置活動項目，而沒有任何其他影響。
   * @param item要設置為活動的項目。
   */
  updateActiveItem(item: T): void;

  updateActiveItem(item: any): void {
    const itemArray = this._getItemsArray();
    const index = typeof item === 'number' ? item : itemArray.indexOf(item);
    const activeItem = itemArray[index];

    // Explicitly check for `null` and `undefined` because other falsy values are valid.
    // 顯式檢查“ null”和“ undefined”，因為其他偽造的值都有效。
    this._activeItem = activeItem == null ? null : activeItem;
    this._activeItemIndex = index;
  }

  /**
   * This method sets the active item, given a list of items and the delta between the
   * currently active item and the new active item. It will calculate differently
   * depending on whether wrap mode is turned on.
   * 給定項目列表以及項目之間的差額，此方法設置活動項目
   * 當前活動項目和新的活動項目。它將以不同的方式計算
   * 取決於是否打開自動換行模式。
   */
  private _setActiveItemByDelta(delta: -1 | 1): void {
    this._wrap ? this._setActiveInWrapMode(delta) : this._setActiveInDefaultMode(delta);
  }

  /**
   * Sets the active item properly given "wrap" mode. In other words, it will continue to move
   * down the list until it finds an item that is not disabled, and it will wrap if it
   * encounters either end of the list.
   *  在“包裝”模式下正確設置活動項目。換句話說，它將繼續發展
   * 向下移動列表，直到找到未禁用的項目為止；如果找到該項目，它將自動換行
   * 遇到列表的任一端。
   */
  private _setActiveInWrapMode(delta: -1 | 1): void {
    const items = this._getItemsArray();

    for (let i = 1; i <= items.length; i++) {
      const index = (this._activeItemIndex + (delta * i) + items.length) % items.length;
      const item = items[index];

      if (!this._skipPredicateFn(item)) {
        this.setActiveItem(index);
        return;
      }
    }
  }

  /**
   * Sets the active item properly given the default mode. In other words, it will
   * continue to move down the list until it finds an item that is not disabled. If
   * it encounters either end of the list, it will stop and not wrap.
   * 在默認模式下正確設置活動項目。換句話說，它將
   * 繼續向下移動列表，直到找到未禁用的項目。如果
   * 它遇到列表的任何一端，它將停止並且不自動換行。
   */
  private _setActiveInDefaultMode(delta: -1 | 1): void {
    this._setActiveItemByIndex(this._activeItemIndex + delta, delta);
  }

  /**
   * Sets the active item to the first enabled item starting at the index specified. If the
   * item is disabled, it will move in the fallbackDelta direction until it either
   * finds an enabled item or encounters the end of the list.
   * 從指定的索引開始，將活動項目設置為第一個啟用的項目。如果
   * 項目被禁用，它將沿fallbackDelta方向移動，直到
   * 查找已啟用的項目或遇到列表的末尾。
   */
  private _setActiveItemByIndex(index: number, fallbackDelta: -1 | 1): void {
    const items = this._getItemsArray();

    if (!items[index]) {
      return;
    }

    while (this._skipPredicateFn(items[index])) {
      index += fallbackDelta;

      if (!items[index]) {
        return;
      }
    }

    this.setActiveItem(index);
  }

  /** Returns the items as an array. 
   * 以數組形式返回項目。
  */
  private _getItemsArray(): T[] {
    return this._items instanceof QueryList ? this._items.toArray() : this._items;
  }
}
