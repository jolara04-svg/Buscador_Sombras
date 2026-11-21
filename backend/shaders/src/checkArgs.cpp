#include "checkArgs.hpp"

#define MESSAGE 1024
char message[MESSAGE];
#define THROW(ret)                                                      \
    Napi::TypeError::New(env, message).ThrowAsJavaScriptException();    \
    return (ret);

bool checkArgCount(Napi::Env& env, const Napi::CallbackInfo& info, size_t argc, const char* funcName){
    if(info.Length()!=argc){
        snprintf(message, MESSAGE,
            "function %s takes exactly %zu positional arguments, but %zu were given",
            funcName, argc, info.Length()
        );
        THROW(true);
    }
    return false;
}

bool checkFunction(Napi::Env& env, const Napi::Value& arg, const char* funcName, const char* argName){
    if(!arg.IsFunction()){
        snprintf(message, MESSAGE,
            "%s argument of function %s must be of type function",
            argName, funcName
        );
        THROW(true);
    }
    return false;
}

bool parseNumber(Napi::Env& env, const Napi::Value& val, const char* attrName, const char* funcName, double& res){
    if(!val.IsNumber()){
        snprintf(message, MESSAGE,
            "%s argument of function %s must be of type number",
            attrName, funcName
        );
        THROW(true);
    }
    res=val.As<Napi::Number>().DoubleValue();
    return false;
}

bool parseGetShadow(Napi::Env& env, const Napi::CallbackInfo& info, const char* funcName, double& lon1, double& lat1, double& lon2, double& lat2, double& elev, double& azim){
    if(checkArgCount(env, info, 6, funcName))
        return true;
    if(parseNumber(env, info[0], "lon1", funcName, lon1))
        return true;
    if(parseNumber(env, info[1], "lat1", funcName, lat1))
        return true;
    if(parseNumber(env, info[2], "lon2", funcName, lon2))
        return true;
    if(parseNumber(env, info[3], "lat2", funcName, lat2))
        return true;
    if(parseNumber(env, info[4], "elev", funcName, elev))
        return true;
    if(parseNumber(env, info[5], "azim", funcName, azim))
        return true;
    return false;
}