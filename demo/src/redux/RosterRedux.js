import { createReducer, createActions } from 'reduxsauce'
import Immutable from 'seamless-immutable'
import _ from 'lodash'
import WebIM from '@/config/WebIM'
import { I18n } from 'react-redux-i18n'
import http from "@/utils/axios"

import CommonActions from '@/redux/CommonRedux'
import MessageActions from '@/redux/MessageRedux'
import { store } from '@/redux'

/* ------------- Types and Action Creators ------------- */
const { Types, Creators } = createActions({
    updateRoster: [ 'roster' ],
    prependRoster: [ 'name' ],
    removeRoster: [ 'name' ],
    topRoster: [ 'name' ],
    // ----------------async------------------
    // get contacts list
    getContacts: () => {
        return (dispatch, getState) => {
            dispatch(CommonActions.fetching())
            WebIM.conn.getContacts({
                success: async(roster) => {
                    console.log('roster', roster)
                    try{
                        let rosterNames = roster.map(item => item.name)
                        await WebIM.conn.fetchUserInfoById(rosterNames).then((res) => {
                            let infos = res.data
                            roster.forEach((item) => {
                                item.info = infos[item.name]
                            })
                            return roster
                        })
                    }catch(e){
                        console.log('111',e);
                    }finally{
                        http("get", `https://a41.easemob.com/inside/chatGPT/robot/name`).then(res => {
                            const chatBotInfo = {
                                name: res.robotName,
                                subscription: "both",
                                jid: WebIM.conn.context.jid,
                                info:{
                                    nickname:res.robotName,
                                },
                                isChatbot: true,
                            }
                            const message = {
                                body:{
                                    msg: "欢迎试用环信 Chatbot，我将解答您提出的任何问题。请注意，提问上限10次，超过上限后我将不再回答您的问题，请您谅解。",
                                    type: "txt",
                                },
                                bySelf: false,
                                error: false,
                                errorCode: "",
                                errorText:"",
                                ext: {},
                                from: res.robotName,
                                id: WebIM.conn.getUniqueId(),
                                isUnread: 0,
                                status: "sent",
                                time: new Date().getTime(),
                                to: WebIM.conn.user,
                                toJid: "",
                                type: "chat",
                            }
                            //插入欢迎语
                            store.dispatch(MessageActions.fetchMessage(res.robotName, "chat", 0, (res) => {
                                if(res===0){
                                    store.dispatch(MessageActions.addMessage(message, 'txt'));
                                }
                            }))
                            roster.unshift(chatBotInfo);
                            dispatch(Creators.updateRoster(roster))
                            dispatch(CommonActions.fetched())
                        }).catch(()=>{
                            dispatch(CommonActions.fetched())
                        })
                    }
                },
                error: error => {
                    //TODO ERROR
                    dispatch(CommonActions.fetched())
                }
            })
        }
    },
    // delete contact
    removeContact: id => {
        return (dispatch, getState) => {
            //loading
            dispatch(CommonActions.fetching())
            try{
                WebIM.conn.deleteContact(id)
                dispatch(CommonActions.fetched())
                dispatch(Creators.getContacts())
            }catch(e){
                dispatch(CommonActions.fetched())
            }
        }
    },
    // add contact
    addContact: id => {
        return (dispatch, getState) => {
            const u = getState().login.username
            WebIM.conn.addContact(id,u + I18n.t('request'))
        }
    },

    getUserInfo: id => {
        return (dispatch, getState) => {
            return WebIM.conn.fetchUserInfoById(id).then((res)=>{
                return res
            })
        }
    },

    updateUserInfo: (key, value) => {
        return (dispatch, getState) => {
            return WebIM.conn.updateOwnUserInfo(key, value).then((res)=>{
                return res
            })
        }
    },

    getAvatarList: () => {
        return (dispatch, getState) => {
            return WebIM.api.get('//download-sdk.oss-cn-beijing.aliyuncs.com/downloads/IMDemo/avatar/headImage.conf')
        }
    },

    updateUserNick: nick => {
        return (dispatch, getState) => {
            return WebIM.conn.updateCurrentUserNick(nick).then((res)=>{
                return res
            })
        }
    }
})

export const RosterTypes = Types
export default Creators

/* ------------- Initial State ------------- */
export const INITIAL_STATE = Immutable({
    byName: null,
    names: [],
    friends: []
})

/* ------------- Reducers ------------- */
function isFriend(v) {
    return v.subscription != 'none'
}

export const updateRoster = (state, { roster }) => {
    let byName = {},
        names = [],
        friends = []
    roster.forEach(v => {
        byName[v.name] = v
        names = Object.keys(byName).sort()
        isFriend(v) && friends.push(v.name)
    })
    return state.merge({
        byName,
        names,
        friends
    })
}

export const prependRoster = (state, { name }) => {
    const friends = state.getIn([ 'friends' ], Immutable([])).asMutable()
    friends.unshift(name)
    return state.merge({ friends })
}

export const removeRoster = (state, { name }) => {
    let friends = state.getIn([ 'friends' ], Immutable([])).asMutable()
    friends = _.without(friends, name)
    return state.merge({ friends })
}

export const topRoster = (state, { name }) => {
    let friends = state.getIn([ 'friends' ], Immutable([])).asMutable()
    if (friends[0] === name) return state // if already top, return directly
    friends = _.without(friends, name)
    friends.unshift(name)
    return state.merge({ friends })
}

/* ------------- Hookup Reducers To Types ------------- */
export const reducer = createReducer(INITIAL_STATE, {
    [Types.UPDATE_ROSTER]: updateRoster,
    [Types.TOP_ROSTER]: topRoster,
    [Types.PREPEND_ROSTER]: prependRoster,
    [Types.REMOVE_ROSTER]: removeRoster
})

/* ------------- Selectors ------------- */
