/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ListKeyManager, ListKeyManagerOption} from './list-key-manager';

/**
 * This is the interface for highlightable items (used by the ActiveDescendantKeyManager).
 * Each item must know how to style itself as active or inactive and whether or not it is
 * currently disabled.
 * 這是用於 highlightable 的 interface（由ActiveDescendantKeyManager使用）。
 * KK[dɪˋsɛndənt]
 * 每個項目都必須知道如何將自己設置為活動或非活動樣式，以及是否為當前已禁用。
 */
export interface Highlightable extends ListKeyManagerOption {
  /** Applies the styles for an active item to this item. 
   * 將活動項目的樣式應用於此項目。
  */
  setActiveStyles(): void;

  /** Applies the styles for an inactive item to this item. 
   * 將非活動項目的樣式應用於此項目
  */
  setInactiveStyles(): void;
}

export class ActiveDescendantKeyManager<T> extends ListKeyManager<Highlightable & T> {

  /**
   * Sets the active item to the item at the specified index and adds the
   * active styles to the newly active item. Also removes active styles
   * from the previously active item.
   * @param index Index of the item to be set as active.
   * 將活動項目設置為指定索引處的項目，並添加
   * 活躍樣式到新活躍項目。同時刪除活動樣式
   * 來自先前活動的項目。
   * @param index要設置為活動的項目的索引。
   */
  setActiveItem(index: number): void;

  /**
   * Sets the active item to the item to the specified one and adds the
   * active styles to the it. Also removes active styles from the
   * previously active item.
   * @param item Item to be set as active.
   * 將活動項設置為指定項並添加
   * 活躍的風格吧。同時從中刪除活動樣式
   * 先前處於活動狀態的項目。
   * @param item要設置為活動的項目。
   */
  setActiveItem(item: T): void;

  setActiveItem(index: any): void {
    if (this.activeItem) {
      this.activeItem.setInactiveStyles();
    }
    super.setActiveItem(index);
    if (this.activeItem) {
      this.activeItem.setActiveStyles();
    }
  }

}
