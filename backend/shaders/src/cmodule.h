#ifndef $CMODULE_H
#define $CMODULE_H
#include "includes.h"
#ifdef __cplusplus
extern "C"{
#endif
PyObject* cmodule_init(void);
void setFilePath(PyObject*);
#ifdef __cplusplus
}
#endif
#endif