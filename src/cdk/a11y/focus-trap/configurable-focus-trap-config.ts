/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * Configuration for creating a ConfigurableFocusTrap.
 * 用於創建ConfigurableFocusTrap的配置。
 */
export class ConfigurableFocusTrapConfig {
  /**
   * Whether to defer the creation of FocusTrap elements to be
   * done manually by the user. Default is to create them
   * automatically.
   * 是否推遲創建FocusTrap元素
   * 由用戶手動完成。默認是創建它們自動地。
   * 
   */
  defer: boolean = false;
}
