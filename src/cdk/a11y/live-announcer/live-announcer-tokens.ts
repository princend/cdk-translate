/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {InjectionToken} from '@angular/core';

// The tokens for the live announcer are defined in a separate file from LiveAnnouncer
// as a workaround for https://github.com/angular/angular/issues/22559
//實時播音員的令牌是在與LiveAnnouncer分開的文件中定義的
//作為https://github.com/angular/angular/issues/22559的解決方法

/** Possible politeness levels. 
 * 可能的Politeness程度。
*/
export type AriaLivePoliteness = 'off' | 'polite' | 'assertive';

export const LIVE_ANNOUNCER_ELEMENT_TOKEN =
    new InjectionToken<HTMLElement | null>('liveAnnouncerElement', {
      providedIn: 'root',
      factory: LIVE_ANNOUNCER_ELEMENT_TOKEN_FACTORY,
    });

/** @docs-private */
export function LIVE_ANNOUNCER_ELEMENT_TOKEN_FACTORY(): null {
  return null;
}

/** Object that can be used to configure the default options for the LiveAnnouncer.
 * 可用於配置LiveAnnouncer的默認選項的對象。
 */
export interface LiveAnnouncerDefaultOptions {
  /** Default politeness for the announcements.
   * 公告的默認禮貌。
   */
  politeness?: AriaLivePoliteness;

  /** Default duration for the announcement messages. 
   * 公告消息的默認持續時間。
  */
  duration?: number;
}

/** Injection token that can be used to configure the default options for the LiveAnnouncer. 
 * 注入令牌，可用於配置LiveAnnouncer的默認選項。
*/
export const LIVE_ANNOUNCER_DEFAULT_OPTIONS =
    new InjectionToken<LiveAnnouncerDefaultOptions>('LIVE_ANNOUNCER_DEFAULT_OPTIONS');
