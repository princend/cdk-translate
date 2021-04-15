/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  InjectionToken,
} from '@angular/core';
import { FocusTrap } from './focus-trap';

/** The injection token used to specify the inert strategy. */
// 用於指定惰性策略的注入令牌。
export const FOCUS_TRAP_INERT_STRATEGY =
  new InjectionToken<FocusTrapInertStrategy>('FOCUS_TRAP_INERT_STRATEGY');

/**
 * A strategy that dictates how FocusTrap should prevent elements
 * outside of the FocusTrap from being focused.
 * 指示FocusTrap應如何防止FocusTrap外部的元素被集中的策略。
 */
export interface FocusTrapInertStrategy {
  /** Makes all elements outside focusTrap unfocusable. */
  // 使focusTrap之外的所有元素都無法聚焦。
  preventFocus(focusTrap: FocusTrap): void;
  /** Reverts elements made unfocusable by preventFocus to their previous state. */
  // 將preventFocus使無法聚焦的元素恢復到其先前狀態。
  allowFocus(focusTrap: FocusTrap): void;
}
