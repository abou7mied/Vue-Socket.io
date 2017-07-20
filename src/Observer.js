import Emitter from './Emitter'
import Socket from 'socket.io-client'

export default class {

    constructor(connection, store, options) {

        if (typeof connection === 'string') {
            this.Socket = Socket(connection, options.io)
        } else {
            this.Socket = connection
        }

        this.options = Object.assign({
            storeMutationPrefix: "SOCKET_",
            storeActionPrefix: "socket_",
            storeMutationTemplate(event) {
                return this.storeMutationPrefix + event.toUpperCase()
            },
            storeActionTemplate(event) {
                return this.storeActionPrefix + event
                    .replace(/^([A-Z])|[\W\s_]+(\w)/g, (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase())
            }
        }, options)

        this.stores = []

        if (store) {
            if (Object.prototype.toString.call(store) === '[object Array]') {
                this.stores = store
            } else {
                this.stores.push(store)
            }
        }

        this.onEvent()
    }


    onEvent() {

        let superOnEvent = this.Socket.onevent
        this.Socket.onevent = (packet) => {
            superOnEvent.call(this.Socket, packet)
            Emitter.emit(packet.data[0], packet.data[1])
            this.passToStores(packet.data[0], [...packet.data.slice(1)])
        }

        [
            "connect", "error", "disconnect", "reconnect", "reconnect_attempt", "reconnecting", "reconnect_error",
            "reconnect_failed", "connect_error", "connect_timeout", "connecting", "ping", "pong"
        ].forEach((value) => {
            this.Socket.on(value, (data) => {
                Emitter.emit(value, data)
                this.passToStores(value, data)
            })
        })
    }

    passToStores(event, payload) {
        for (let i = 0; i < this.stores.length; i++) this.passToStore(this.stores[i], event, payload)
    }

    passToStore(store, event, payload) {

        for (let namespaced in store._mutations) {
            if (!Object.prototype.hasOwnProperty.call(store._mutations, namespaced)) continue
            let mutation = namespaced.split('/').pop()
            if (mutation === this.options.storeMutationTemplate(event)) store.commit(namespaced, payload)
        }

        for (let namespaced in store._actions) {
            if (!Object.prototype.hasOwnProperty.call(store._actions, namespaced)) continue
            let action = namespaced.split('/').pop()
            let camelcased = this.options.storeActionTemplate(event)
            if (action === camelcased) store.dispatch(namespaced, payload)
        }
    }
}
