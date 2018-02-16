# WonderQ

<a href="https://travis-ci.org/snlamm/WonderQ"><img src="https://travis-ci.org/snlamm/WonderQ.svg?branch=master" alt="Build Status"></a>

A demo queueing system with a sqlite-backed message broker, sample client app, and dev tool.

<!-- TOC depthFrom:2 depthTo:2 withLinks:1 updateOnSave:1 orderedList:0 -->

- [Broker](#broker)
- [Dev Tool](#dev-tool)
- [User App](#user-app)
- [Scaling for high volume](#scaling-for-high-volume)
- [Tests](#tests)

<!-- /TOC -->
---
## Broker

To start the broker, use `yarn run broker`. It will serve on port 3213

---
### Endpoints


##### `POST /queues`

_Creates a queue_

Parameters:

* `name`: name for the queue (string, required)

Returns: Queue model object


----
##### `GET /queues/find`

_Find a queue_

Parameters:

- `name`: name to search for (string)
- `id`: ID to search for (int)

Returns: Queue model object

---

##### `DELETE /queues/:queue`

_Delete a queue_

Parameters: none

Returns: Object with a success boolean

---

##### `POST /messages`

_Create a message_

Parameters:

- `queue_id`: id of the message queue (int)
- `queue_name`: name of the message queue (string)
- `body`: data to save to the body of the message (string, required)

queue_id or queue_name is required.

Returns: Object with the message ID

---

##### `GET /messages/consume`

_Retrieve messages from the queue_

Parameters:

- `queue_id`: id of the message queue (int)
- `queue_name`: name of the message queue (string)
- `size`: max number of messages to retrieve. Default 1 (int)
- `wait_time`: max time to poll db for new messages, in seconds. Default 20 (int)
- `visibility_timeout`: time until a polled message will become visible again in the queue, in seconds. Default 30 (int)

queue_id or queue_name is required.

Returns: Array of message model objects

Details:

- The database will be polled for new messages every few seconds until a message(s) is returned or the wait time is exceeded
- Each found message model is updated so that it will not be retrieved again until the visibility timeout expires
- In cases of concurrent/parallel 'consume' requests, we want to enforce once-only processing, which means the same message won't be pulled multiple times even while its visibility timeout is being set.
- To help enforce once-only processing, we use a two step process. Once the message is pulled, both its visibility timeout and a unique token are set. The timeout means no other processes will continue to pull it. The message is then _repulled_ from the database using the unique token.

---

##### `DELETE /messages/:message`

_Delete a message_

Parameters: none

Returns: Object with a success boolean

---
---

## Dev Tool

To start the dev tool, use `yarn run dev`. It will serve on port 3210. To use it, make sure the broker is also running.

---
### Endpoints


##### `GET /queues`

_See queues and queue data_

Parameters: none

Returns: Array of queue model objects that, for each one, includes counts of the number of messages and 'retrievable messages' it has (i.e. messages not restricted by a visibility timeout).

---

##### `GET /queues/:queue`

_See contents of a queue_

Parameters:

- `size`: number of messages to show. Default 10 (int)

Returns: Array of message model objects

---
---

## User App

To start the user app, use `yarn run user`. It will serve on port 3000. To use it, make sure the broker is also running.

---
### Endpoints

##### `POST /dispatch`

_Dispatch messages to a queue_

Parameters:
- `queue_id`: id of the message queue (int)
- `queue_name`: name of the message queue (string)
- `body`: data to save to the body of the message (string, required)
- `stub`: number of stub messages to programmatically generate. Only used if `body` is not set. Default 1 (int)

queue_id or queue_name is required.


Returns: object with - the number of created messages, an array of message objects with the id of each message created, and a failures array with any messages that errored in dispatching and the error reason.

---

##### `GET /listen`

_Consume messages from a queue_

Parameters:
- `queue_id`: id of the message queue (int)
- `queue_name`: name of the message queue (string)
- `size`: max number of messages the broker should be instructed to retrieve at a time (int)
- `wait_time`: max time that the broker should be instructed to poll the db for, in seconds (int)
- `visibility_timeout`: time period the broker should be instructed to set for a polled message for when it will become visible again in the queue, in seconds (int)

queue_id or queue_name is required.

Returns: see details. Logs message body data to stdout.

Details:

- This request is not terminated by default. Once terminated, the app will continue to poll until exited and its sockets are destroyed. This allows the user to keep calling /dispatch and adding more messages even while consuming the queue.
- This continuous polling is accomplished internally by repeatedly calling the broker `GET /messages/consume` endpoint.
- Messages are 'consumed' by logging their content body to stdout.
- After logging to console, messages are deleted by internally calling the broker `DELETE /messages/:message endpoint`.


## Scaling for high volume

To scale for high volume, here are some modifications/infrastructure examples with AWS:

- Consider running the broker in cluster mode to take advantage of multiple cores, especially if the queue will grow to a large size. That's actually built into the current api: use `yarn run broker --cluster`
- Run the broker on a larger, more optimized type EC2 instance, such as an M5.
- Use a production grade database for the broker with a larger instance size, such as RDS MySQL/PostgreSQL/etc to handle higher volume. Consider that currently, at ~500 concurrent message dispatches, the local sqlite db can start throwing a lock error or two (though the current api automatically re-dispatches to gracefully handle the error).
- Alternatively, though the broker is not abstracted around a Redis store, consider using one such as ElastiCache for faster in-memory performance.
- Deploy any client app to multiple EC2 servers in an AWS auto-scaling group. Put them behind a load balancer. This can be done for the broker as well.
- If possible, as a security practice, consider placing the client app in a public subnet and the broker in a private subnet within the same VPC.


## Tests

To run the tests, use `yarn run test`

To run the linter, use `yarn run lint`
