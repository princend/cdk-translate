/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/** IDs are delimited by an empty space, as per the spec. */
/**根據規範，ID由空格分隔。 */
const ID_DELIMITER = ' ';

/**
 * Adds the given ID to the specified ARIA attribute on an element.
 * Used for attributes such as aria-labelledby, aria-owns, etc.
 * 
 * 將給定ID添加到元素上的指定ARIA屬性。用於諸如aria-labeledby，aria-owns等屬性。
 */
export function addAriaReferencedId(el: Element, attr: string, id: string) {
  const ids = getAriaReferenceIds(el, attr);
  if (ids.some(existingId => existingId.trim() == id.trim())) { return; }
  ids.push(id.trim());

  el.setAttribute(attr, ids.join(ID_DELIMITER));
}

/**
 * Removes the given ID from the specified ARIA attribute on an element.
 * Used for attributes such as aria-labelledby, aria-owns, etc.
 * 從元素上的指定ARIA屬性中刪除給定的ID。用於諸如aria-labeledby，aria-owns等屬性。
 */
export function removeAriaReferencedId(el: Element, attr: string, id: string) {
  const ids = getAriaReferenceIds(el, attr);
  const filteredIds = ids.filter(val => val != id.trim());

  if (filteredIds.length) {
    el.setAttribute(attr, filteredIds.join(ID_DELIMITER));
  } else {
    el.removeAttribute(attr);
  }
}

/**
 * Gets the list of IDs referenced by the given ARIA attribute on an element.
 * Used for attributes such as aria-labelledby, aria-owns, etc.
 * 獲取元素上給定的ARIA屬性引用的ID列表。用於諸如aria-labeledby，aria-owns等屬性。
 */
export function getAriaReferenceIds(el: Element, attr: string): string[] {
  // Get string array of all individual ids (whitespace delimited) in the attribute value
  // 獲取屬性值中所有單個ID（以空格分隔）的字符串數組
  return (el.getAttribute(attr) || '').match(/\S+/g) || [];
}
