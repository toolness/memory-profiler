#! /bin/bash

JETPACK=../jetpack
STUB=extension/components/stub.js
XPT=extension/components/jetpack.xpt
LIB=extension/lib

rm -f $STUB
rm -f $XPT
rm -rf extension/lib

cp $JETPACK/$STUB $STUB
cp $JETPACK/$XPT $XPT
cp -R $JETPACK/$LIB $LIB
