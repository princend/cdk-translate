/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, OnDestroy } from '@angular/core';
import { addAriaReferencedId, getAriaReferenceIds, removeAriaReferencedId } from './aria-reference';


/**
 * Interface used to register message elements and keep a count of how many registrations have
 * the same message and the reference to the message element used for the `aria-describedby`.
 * 用於註冊消息元素並保留有多少個註冊具有相同消息的接口，以及對用於“ aria- describeby”的消息元素的引用的計數。
 */
export interface RegisteredMessage {
  /** The element containing the message. */
  // 包含消息的元素。
  messageElement: Element;

  /** The number of elements that reference this message element via `aria-describedby`. */
  // 通過“ aria- describeby”引用此消息元素的元素數。
  referenceCount: number;
}

/** ID used for the body container where all messages are appended. */
/** 用於附加所有消息的正文容器的ID。 */
export const MESSAGES_CONTAINER_ID = 'cdk-describedby-message-container';

/** ID prefix used for each created message element. */
/* 用於每個創建的消息元素的ID前綴。 */
export const CDK_DESCRIBEDBY_ID_PREFIX = 'cdk-describedby-message';

/** Attribute given to each host element that is described by a message element. */
/* 賦予消息元素描述的每個主機元素的屬性。 */
export const CDK_DESCRIBEDBY_HOST_ATTRIBUTE = 'cdk-describedby-host';

/** Global incremental identifier for each registered message element. */
/** 每個已註冊消息元素的全局增量標識符。 */
let nextId = 0;

/** Global map of all registered message elements that have been placed into the document. */
/**
 *  放置在文檔中的所有已註冊消息元素的全局映射。
 */
const messageRegistry = new Map<string | Element, RegisteredMessage>();

/** Container for all registered messages. */
/** 
所有已註冊消息的容器。 */
let messagesContainer: HTMLElement | null = null;

/**
 * Utility that creates visually hidden elements with a message content. Useful for elements that
 * want to use aria-describedby to further describe themselves without adding additional visual
 * content.
 */
/**
 * 該實用程序創建帶有消息內容的視覺上隱藏的元素。對於想要使用aria- describeby元素來進一步描述自己而不增加額外視覺效果的元素很有用
 內容。
 */
@Injectable({ providedIn: 'root' })
export class AriaDescriber implements OnDestroy {
  private _document: Document;

  constructor(
    @Inject(DOCUMENT) _document: any) {
    this._document = _document;
  }

  /**
   * Adds to the host element an aria-describedby reference to a hidden element that contains
   * the message. If the same message has already been registered, then it will reuse the created
   * message element.
   * 
   * 通過引用包含以下內容的隱藏元素，將host-aria添加到host元素中
消息。如果已經註冊了相同的消息，那麼它將重用創建的消息
 消息元素。
   */
  describe(hostElement: Element, message: string, role?: string): void;

  /**
   * Adds to the host element an aria-describedby reference to an already-existing message element.
   * 通過引用已經存在的message元素將aria-描述添加到host元素。
   */
  describe(hostElement: Element, message: HTMLElement): void;

  describe(hostElement: Element, message: string | HTMLElement, role?: string): void {
    if (!this._canBeDescribed(hostElement, message)) {
      return;
    }

    const key = getKey(message, role);

    if (typeof message !== 'string') {
      // We need to ensure that the element has an ID.
      // 我們需要確保該元素具有ID。
      setMessageId(message);
      messageRegistry.set(key, { messageElement: message, referenceCount: 0 });
    } else if (!messageRegistry.has(key)) {
      this._createMessageElement(message, role);
    }

    if (!this._isElementDescribedByMessage(hostElement, key)) {
      this._addMessageReference(hostElement, key);
    }
  }

  /** Removes the host element's aria-describedby reference to the message. */
  /**
   *  刪除宿主元素的 aria-describedby （通過參考消息來描述）。
   * @param hostElement 
   * @param message 
   * @param role 
   */
  removeDescription(hostElement: Element, message: string, role?: string): void;

  /** Removes the host element's aria-describedby reference to the message element. */
  /**通過引用message元素除去host元素的aria描述。 */
  removeDescription(hostElement: Element, message: HTMLElement): void;

  removeDescription(hostElement: Element, message: string | HTMLElement, role?: string): void {
    if (!message || !this._isElementNode(hostElement)) {
      return;
    }

    const key = getKey(message, role);

    if (this._isElementDescribedByMessage(hostElement, key)) {
      this._removeMessageReference(hostElement, key);
    }

    // If the message is a string, it means that it's one that we created for the
    // consumer so we can remove it safely, otherwise we should leave it in place.
    /** 如果消息是字符串，則表示它是我們為消費者創建的消息，因此我們可以安全地將其刪除，否則應將其保留在原位。 */
    if (typeof message === 'string') {
      const registeredMessage = messageRegistry.get(key);
      if (registeredMessage && registeredMessage.referenceCount === 0) {
        this._deleteMessageElement(key);
      }
    }

    if (messagesContainer && messagesContainer.childNodes.length === 0) {
      this._deleteMessagesContainer();
    }
  }

  /** Unregisters all created message elements and removes the message container. */
  /** 註銷所有創建的消息元素，並刪除消息容器。 */
  ngOnDestroy() {
    const describedElements =
      this._document.querySelectorAll(`[${CDK_DESCRIBEDBY_HOST_ATTRIBUTE}]`);

    for (let i = 0; i < describedElements.length; i++) {
      this._removeCdkDescribedByReferenceIds(describedElements[i]);
      describedElements[i].removeAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE);
    }

    if (messagesContainer) {
      this._deleteMessagesContainer();
    }

    messageRegistry.clear();
  }

  /**
   * Creates a new element in the visually hidden message container element with the message
   * as its content and adds it to the message registry.
   * 
   * 在以消息為內容的可視隱藏消息容器元素中創建一個新元素，並將其添加到消息註冊表中。
   */
  private _createMessageElement(message: string, role?: string) {
    const messageElement = this._document.createElement('div');
    setMessageId(messageElement);
    messageElement.textContent = message;

    if (role) {
      messageElement.setAttribute('role', role);
    }

    this._createMessagesContainer();
    messagesContainer!.appendChild(messageElement);
    messageRegistry.set(getKey(message, role), { messageElement, referenceCount: 0 });
  }

  /** Deletes the message element from the global messages container. */
  /**從全局消息容器中刪除消息元素。 */
  private _deleteMessageElement(key: string | Element) {
    const registeredMessage = messageRegistry.get(key);
    const messageElement = registeredMessage && registeredMessage.messageElement;
    if (messagesContainer && messageElement) {
      messagesContainer.removeChild(messageElement);
    }
    messageRegistry.delete(key);
  }

  /** Creates the global container for all aria-describedby messages. */
  /**為所有aria-describedby 訊息 創建全局容器。 */
  private _createMessagesContainer() {
    if (!messagesContainer) {
      const preExistingContainer = this._document.getElementById(MESSAGES_CONTAINER_ID);

      // When going from the server to the client, we may end up in a situation where there's
      // already a container on the page, but we don't have a reference to it. Clear the
      // old container so we don't get duplicates. Doing this, instead of emptying the previous
      // container, should be slightly faster.
      // 從服務器到客戶端時，我們可能會遇到這樣一種情況，即頁面上已經有一個容器，
      // 但是我們沒有對其的引用。清除舊容器，以免重複。這樣做比倒空以前的容器要快一些。
      if (preExistingContainer && preExistingContainer.parentNode) {
        preExistingContainer.parentNode.removeChild(preExistingContainer);
      }

      messagesContainer = this._document.createElement('div');
      messagesContainer.id = MESSAGES_CONTAINER_ID;
      // We add `visibility: hidden` in order to prevent text in this container from
      // being searchable by the browser's Ctrl + F functionality.
      // Screen-readers will still read the description for elements with aria-describedby even
      // when the description element is not visible.
      // 為了防止瀏覽器的Ctrl + F功能搜索此容器中的文本，我們添加了“ visibility：hidden”。
      // 即使描述元素不可見，屏幕閱讀器仍將閱讀帶有aria-destroy元素的描述。
      messagesContainer.style.visibility = 'hidden';
      // Even though we use `visibility: hidden`, we still apply `cdk-visually-hidden` so that
      // the description element doesn't impact page layout.
      // 即使我們使用“ visibility：hidden”，我們仍然會應用“ cdk-visually-hidden”，以便description元素不會影響頁面佈局。
      messagesContainer.classList.add('cdk-visually-hidden');

      this._document.body.appendChild(messagesContainer);
    }
  }

  /** Deletes the global messages container. */
  /** 刪除全局消息容器 */
  private _deleteMessagesContainer() {
    if (messagesContainer && messagesContainer.parentNode) {
      messagesContainer.parentNode.removeChild(messagesContainer);
      messagesContainer = null;
    }
  }

  /** Removes all cdk-describedby messages that are hosted through the element. */
  /** 刪除通過元素託管的所有cdk-describedby消息。 */
  private _removeCdkDescribedByReferenceIds(element: Element) {
    // Remove all aria-describedby reference IDs that are prefixed by CDK_DESCRIBEDBY_ID_PREFIX
    // 刪除以CDK_DESCRIBEDBY_ID_PREFIX為前綴的所有由aria描述的參考ID
    const originalReferenceIds = getAriaReferenceIds(element, 'aria-describedby')
      .filter(id => id.indexOf(CDK_DESCRIBEDBY_ID_PREFIX) != 0);
    element.setAttribute('aria-describedby', originalReferenceIds.join(' '));
  }

  /**
   * Adds a message reference to the element using aria-describedby and increments the registered
   * message's reference count.
   * 
   * 使用aria- describeby將消息引用添加到元素，並增加已註冊消息的引用計數。
   */
  private _addMessageReference(element: Element, key: string | Element) {
    const registeredMessage = messageRegistry.get(key)!;

    // Add the aria-describedby reference and set the
    // describedby_host attribute to mark the element.
    //添加aria- describeby引用並設置describeby_host屬性以標記該元素。
    addAriaReferencedId(element, 'aria-describedby', registeredMessage.messageElement.id);
    element.setAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE, '');
    registeredMessage.referenceCount++;
  }

  /**
   * Removes a message reference from the element using aria-describedby
   * and decrements the registered message's reference count.
   * 使用aria- describeby從元素中刪除消息引用，並減少已註冊消息的引用計數。
   */
  private _removeMessageReference(element: Element, key: string | Element) {
    const registeredMessage = messageRegistry.get(key)!;
    registeredMessage.referenceCount--;

    removeAriaReferencedId(element, 'aria-describedby', registeredMessage.messageElement.id);
    element.removeAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE);
  }

  /** Returns true if the element has been described by the provided message ID. */
  /**如果元素已由提供的消息ID描述，則返回true。 */
  private _isElementDescribedByMessage(element: Element, key: string | Element): boolean {
    const referenceIds = getAriaReferenceIds(element, 'aria-describedby');
    const registeredMessage = messageRegistry.get(key);
    const messageId = registeredMessage && registeredMessage.messageElement.id;

    return !!messageId && referenceIds.indexOf(messageId) != -1;
  }

  /** Determines whether a message can be described on a particular element. */
  /**確定是否可以在特定元素上描述消息。 */
  private _canBeDescribed(element: Element, message: string | HTMLElement | void): boolean {
    if (!this._isElementNode(element)) {
      return false;
    }

    if (message && typeof message === 'object') {
      // We'd have to make some assumptions about the description element's text, if the consumer
      // passed in an element. Assume that if an element is passed in, the consumer has verified
      // that it can be used as a description.
      // 如果使用者傳入一個元素，則我們必須對description元素的文本進行一些假設。
      // 假定如果傳入一個元素，則使用者已經確認可以將其用作描述。
      return true;
    }

    const trimmedMessage = message == null ? '' : `${message}`.trim();
    const ariaLabel = element.getAttribute('aria-label');

    // We shouldn't set descriptions if they're exactly the same as the `aria-label` of the
    // element, because screen readers will end up reading out the same text twice in a row.
    // 如果它們與元素的“ a​​ria-label”完全相同，則不應設置描述，因為屏幕閱讀器最終將連續兩次讀取相同的文本。
    return trimmedMessage ? (!ariaLabel || ariaLabel.trim() !== trimmedMessage) : false;
  }

  /** Checks whether a node is an Element node. */
  /** 檢查節點是否為元素節點。 */
  private _isElementNode(element: Node): element is Element {
    return element.nodeType === this._document.ELEMENT_NODE;
  }
}

/** Gets a key that can be used to look messages up in the registry. */
/** 獲取可用於在註冊表中查找消息的鍵。 */
function getKey(message: string | Element, role?: string): string | Element {
  return typeof message === 'string' ? `${role || ''}/${message}` : message;
}

/** Assigns a unique ID to an element, if it doesn't have one already. */
/** 如果元素還沒有，則為其分配一個唯一的ID。 */
function setMessageId(element: HTMLElement) {
  if (!element.id) {
    element.id = `${CDK_DESCRIBEDBY_ID_PREFIX}-${nextId++}`;
  }
}
