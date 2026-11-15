#ifndef $SHADOWCALC_H
#define $SHADOWCALC_H
#include "includes.h"
#ifdef __cplusplus
extern "C"{
#endif
void setModule(PyObject* _module);
void setTrimesh(PyObject* _module);
void setMadridFilePath();
double getShade(double lon1, double lat1, double lon2, double lat2, double elev, double azim, size_t samples);
void* initializeNumPy();
#ifdef __cplusplus
}
#endif
#endif