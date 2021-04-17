/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ListKeyManager, ListKeyManagerOption} from './list-key-manager';
import {FocusOrigin} from '../focus-monitor/focus-monitor';

/**
 * This is the interface for focusable items (used by the FocusKeyManager).
 * Each item must know how to focus itself, whether or not it is currently disabled
 * and be able to supply its label.
 * 這是可聚焦項的界面（由FocusKeyManager使用）。
 * 每個項目都必須知道如何專注於自己，無論當前是否被禁用
 * 並能夠提供其標籤。
 */
export interface FocusableOption extends ListKeyManagerOption {
  /** Focuses the `FocusableOption`.
   * 重點關注“ FocusableOption”。
   */
  focus(origin?: FocusOrigin): void;
}

export class FocusKeyManager<T> extends ListKeyManager<FocusableOption & T> {
  private _origin: FocusOrigin = 'program';

  /**
   * Sets the focus origin that will be passed in to the items for any subsequent `focus` calls.
   * @param origin Focus origin to be used when focusing items.
   * 設置焦點原點，該焦點原點將傳遞給後續任何“ focus”調用的項目。
   * @param origin聚焦項目時使用的聚焦原點。
   */
  setFocusOrigin(origin: FocusOrigin): this {
    this._origin = origin;
    return this;
  }

  /**
   * Sets the active item to the item at the specified
   * index and focuses the newly active item.
   * @param index Index of the item to be set as active.
   * 將活動項目設置為指定的項目
   * 索引並聚焦新活動的項目。
   * @param index要設置為活動的項目的索引。
   */
  setActiveItem(index: number): void;

  /**
   * Sets the active item to the item that is specified and focuses it.
   * @param item Item to be set as active.
   * 將活動項目設置為指定的項目並對其進行聚焦。
   * @param item要設置為活動的項目。
   */
  setActiveItem(item: T): void;

  setActiveItem(item: any): void {
    super.setActiveItem(item);

    if (this.activeItem) {
      this.activeItem.focus(this._origin);
    }
  }
}
