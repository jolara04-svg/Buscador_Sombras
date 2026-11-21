#ifndef $CHECKARGS_H
#define $CHECKARGS_H
#include "includes.h"

bool checkArgCount(Napi::Env& env, const Napi::CallbackInfo& info, size_t argc, const char* funcName);
bool checkFunction(Napi::Env& env, const Napi::Value& arg, const char* funcName, const char* argName);
bool parseNumber(Napi::Env& env, const Napi::Value& val, const char* attrName, const char* funcName, float& res);
bool parseGetShadow(Napi::Env& env, const Napi::CallbackInfo& info, const char* funcName, double& lon1, double& lat1, double& lon2, double& lat2, double& elev, double& azim);
#endif