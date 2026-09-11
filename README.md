<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# Huddle Backend — Channels & Messaging

## Sprint 1 — Channels & Messaging

Implemented the backend functionality for:

* Creating channels
* Automatically adding the creator as a channel member
* Listing channels available to the current user
* Getting a channel
* Joining public channels
* Listing channel members
* Sending messages to a channel
* Reading messages from a channel
* Preventing non-members from sending/reading messages
* Pagination support for channel messages

---

## Authentication Integration

### Current development setup

The real JWT authentication is being handled separately by the authentication developer.

For development/testing, the channel and messaging endpoints currently use a **temporary development auth guard** that sets:

```text
user.id = "test-user-1"
```

This is **not production authentication** and must be replaced with the real JWT authentication before merging into the main branch.

### What the auth developer needs to do

The real `JwtAuthGuard` should authenticate the request and make the authenticated user's ID available as:

```ts
request.user.id
```

The existing controllers already use:

```ts
@CurrentUser() user: { id: string }
```

So the authentication implementation should make sure `request.user.id` contains the authenticated user's database ID.

The channel and messaging code does not need to be changed to receive the user ID once the real guard is connected.

---

## Channel Endpoints

All channel endpoints require authentication.

### Create channel

```http
POST /channels
```

Request:

```json
{
  "name": "general",
  "description": "General discussion",
  "isPrivate": false
}
```

The authenticated user automatically becomes a member of the channel.

### List channels

```http
GET /channels
```

Returns public channels and private channels that the authenticated user belongs to.

### Get channel

```http
GET /channels/:id
```

### Join channel

```http
POST /channels/:id/join
```

Users can join public channels.

Private channels return `403 Forbidden`.

### List members

```http
GET /channels/:id/members
```

---

## Messaging Endpoints

### Send message

```http
POST /channels/:channelId/messages
```

Request:

```json
{
  "content": "Hey team!"
}
```

The sender is taken from the authenticated user:

```ts
user.id
```

The user must be a member of the channel.

### Read messages

```http
GET /channels/:channelId/messages
```

Messages are returned with pagination support.

Only channel members can read messages.

---

## Database Models

The implementation uses:

```text
User
  │
  ├── Channel (createdChannels)
  ├── ChannelMember
  └── Message

Channel
  │
  ├── ChannelMember
  └── Message

ChannelMember
  ├── User
  └── Channel

Message
  ├── User (sender)
  └── Channel
```

Important relationship:

```text
User ←→ ChannelMember ←→ Channel
```

This is used to determine whether a user belongs to a channel.

---

## Important ID Note

The project uses Prisma `cuid()` IDs, **not UUIDs**.

Therefore, the controllers use:

```ts
@Param('id') id: string
```

and should **not** use:

```ts
ParseUUIDPipe
```

The same applies to `channelId`.

---

## Authentication Handoff

Before merging this branch into `main`:

1. Replace the temporary development `JwtAuthGuard` with the real JWT guard.
2. Ensure authenticated requests populate:

```ts
request.user = {
  id: authenticatedUserId
}
```

3. Ensure `@CurrentUser()` continues to return the authenticated user.
4. Remove the hard-coded:

```text
test-user-1
```

authentication behavior.
5. Test the following with two real users:

* User A creates a channel.
* User B joins the channel.
* User A sends a message.
* User B reads the message.
* A non-member cannot send/read messages.
* Private channels reject unauthorized users.

---

## Development Testing

The channel and messaging flow has already been tested successfully with:

```text
POST /channels
POST /channels/:channelId/messages
GET /channels/:channelId/messages
```

Channel creation, creator membership, message creation, message persistence, and message retrieval are working.

Branch:

```text
feat/channels-creation-and--messaging
```

