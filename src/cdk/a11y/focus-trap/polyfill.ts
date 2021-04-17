/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/** IE 11 compatible closest implementation that is able to start from non-Element Nodes. */
// IE 11兼容的最接近的implementation，能夠從非元素節點開始。
export function closest(element: EventTarget | Element | null | undefined, selector: string):
  Element | null {
  if (!(element instanceof Node)) { return null; }

  let curr: Node | null = element;
  while (curr != null && !(curr instanceof Element)) {
    curr = curr.parentNode;
  }

  return curr && (hasNativeClosest ?
    curr.closest(selector) : polyfillClosest(curr, selector)) as Element | null;
}

/** Polyfill for browsers without Element.closest. */
// 適用於沒有Element.closest的瀏覽器的Polyfill。
function polyfillClosest(element: Element, selector: string): Element | null {
  let curr: Node | null = element;
  while (curr != null && !(curr instanceof Element && matches(curr, selector))) {
    curr = curr.parentNode;
  }

  return (curr || null) as Element | null;
}

const hasNativeClosest = typeof Element != 'undefined' && !!Element.prototype.closest;

/** IE 11 compatible matches implementation. */
// 兼容IE 11的匹配implementation。
function matches(element: Element, selector: string): boolean {
  return element.matches ?
    element.matches(selector) :
    (element as any)['msMatchesSelector'](selector);
}
