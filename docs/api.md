## Classes

<dl>
<dt><a href="#WebLedgerClient">WebLedgerClient</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#Agent">Agent</a> : <code>Object</code></dt>
<dd><p>An SSL capable http Agent.</p>
</dd>
<dt><a href="#JSON-LD">JSON-LD</a> : <code>Object</code></dt>
<dd><p>A Document used by the Ledger.</p>
</dd>
</dl>

<a name="WebLedgerClient"></a>

## WebLedgerClient
**Kind**: global class  

* [WebLedgerClient](#WebLedgerClient)
    * [new WebLedgerClient(options)](#new_WebLedgerClient_new)
    * [.getRecord(options)](#WebLedgerClient+getRecord) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getDocument(options)](#WebLedgerClient+getDocument) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getStatus([options])](#WebLedgerClient+getStatus) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getTargetNode()](#WebLedgerClient+getTargetNode) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.sendConfig(options)](#WebLedgerClient+sendConfig) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.sendDocument(options)](#WebLedgerClient+sendDocument) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.sendOperation(options)](#WebLedgerClient+sendOperation) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getAgents([options])](#WebLedgerClient+getAgents) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
    * [.getAgent([options])](#WebLedgerClient+getAgent) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.wrap(options)](#WebLedgerClient+wrap) ⇒ <code>Promise.&lt;Object&gt;</code>

<a name="new_WebLedgerClient_new"></a>

### new WebLedgerClient(options)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Options for the WebLedgerClient. |
| options.hostname | <code>string</code> | The hostname of the ledger node. |
| [options.logger] | <code>Object</code> | The logger to use. |
| [options.httpsAgent] | [<code>Agent</code>](#Agent) | - A NodeJS HTTPS Agent (`https.Agent`) instance. |

<a name="WebLedgerClient+getRecord"></a>

### webLedgerClient.getRecord(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Fetches a Record for a given ID.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - - The record object.  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Options for getRecord. |
| options.id | <code>string</code> | The ID URI for the record. |

<a name="WebLedgerClient+getDocument"></a>

### webLedgerClient.getDocument(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Gets a document.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - The requested document.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | Options for getDocument. |
| [options.headers] | <code>Object</code> | <code>{}</code> | Headers for the request. |
| options.service | <code>string</code> |  | The name of the service to use. |

<a name="WebLedgerClient+getStatus"></a>

### webLedgerClient.getStatus([options]) ⇒ <code>Promise.&lt;Object&gt;</code>
Gets the status of a Document from the ledger Agent Status Service.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A document with a status.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | Options for getStatus. |
| [options.headers] | <code>Object</code> | <code>{}</code> | Headers for the request. |

<a name="WebLedgerClient+getTargetNode"></a>

### webLedgerClient.getTargetNode() ⇒ <code>Promise.&lt;string&gt;</code>
Returns the targetNode for the ledger agent associated with
the WebLedgerClient instance.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;string&gt;</code> - The targetNode.  
<a name="WebLedgerClient+sendConfig"></a>

### webLedgerClient.sendConfig(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Sends a configuration Document to a service.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - The result of the send.  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Options for sendConfig. |
| options.ledgerConfiguration | [<code>JSON-LD</code>](#JSON-LD) | Doc with config options. |

<a name="WebLedgerClient+sendDocument"></a>

### webLedgerClient.sendDocument(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Sends a document to a ledger service.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - The result of the send.  
**Throws**:

- <code>WebLedgerClientError</code> 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | Options for sendDocument. |
| options.document | [<code>JSON-LD</code>](#JSON-LD) |  | A valid document for the ledger. |
| options.service | <code>string</code> |  | The name of a ledger service. |
| [options.headers] | <code>Object</code> | <code>{}</code> | Headers for the request. |

<a name="WebLedgerClient+sendOperation"></a>

### webLedgerClient.sendOperation(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Sends an operation to a Web Ledger node.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A response object.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | Options for this function. |
| options.operation | <code>Object</code> |  | The operation to send. |
| [options.headers] | <code>Object</code> | <code>{}</code> | The headers for the request. |

<a name="WebLedgerClient+getAgents"></a>

### webLedgerClient.getAgents([options]) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
Resolves with a list of ledger agents.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code> - An array of ledger agents.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | Options for getAgents. |
| [options.headers] | <code>Object</code> | <code>{}</code> | The headers for the request. |

<a name="WebLedgerClient+getAgent"></a>

### webLedgerClient.getAgent([options]) ⇒ <code>Promise.&lt;Object&gt;</code>
Resolves with a single ledger agent for given options. If "id" is not
specified the first ledger agent will be resolved.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - A ledger agent.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Object</code> | <code>{}</code> | Options for getAgent. |
| [options.id] | <code>string</code> |  | The ledger agent ID. |

<a name="WebLedgerClient+wrap"></a>

### webLedgerClient.wrap(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Wraps a Record in a Web Ledger Operation.

**Kind**: instance method of [<code>WebLedgerClient</code>](#WebLedgerClient)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - - The wrapped record.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | Options for wrap. |
| options.record | <code>Object</code> |  | The record to wrap into an operation. |
| [options.addCreator] | <code>boolean</code> | <code>true</code> | - Assign the ledger agent's `targetNode`  as the `creator` in the wrapped operation. |
| [options.operationType] | <code>&#x27;create&#x27;</code> \| <code>&#x27;update&#x27;</code> | <code>create</code> | - The type of wrapper to generate. |

<a name="Agent"></a>

## Agent : <code>Object</code>
An SSL capable http Agent.

**Kind**: global typedef  
**See**: https://nodejs.org/api/https.html  
<a name="JSON-LD"></a>

## JSON-LD : <code>Object</code>
A Document used by the Ledger.

**Kind**: global typedef  
**See**

- https://w3c.github.io/json-ld-syntax/
- https://w3c-dvcg.github.io/ld-signatures/

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| @context | <code>string</code> | Used to define the terms in the document. |
| @id | <code>string</code> | A unique id for the document. |

