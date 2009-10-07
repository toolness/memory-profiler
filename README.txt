Installing Memory Profiler
--------------------------

To install Memory Profiler for development purposes to your default
Firefox profile, just enter the root directory of your Memory Profiler
source code checkout and run:

  python manage.py install

If you have a separate profile that you'd prefer to install the
extension under, such as 'testing', you can add that as an optional
parameter:

  python manage.py install --profile=testing

Building Binary Components
--------------------------

Pre-compiled binary components needed by Memory Profiler are kept in the
repository, so it's likely that you don't need to compile anything to
start using it. However, if a version of the components don't exist
for your OS and/or Gecko platform, you'll need to build them yourself.

To do this, you actually need to get Jetpack's source code and
compile its binary component, as Jetpack's binary components are
what power Memory Profiler.

So, you need to get Jetpack from here:

  http://hg.mozilla.org/labs/jetpack/

Make sure you clone this repository in a directory "parallel to"
Memory Profiler's directory. In other words, if this file is
located at /foo/memory-profiler/README.txt, then Jetpack's
README should be at /foo/jetpack/README.

Read Jetpack's README, and build its binary components. Then, go into
Memory Profiler's root directory and run:

  ./copy-files-from-jetpack.sh

This will copy the binary components from Jetpack's repository to the
proper location in Memory Profiler.

Using Memory Profiler
---------------------

Just go to the "Tools" menu and select "Memory Profiler".

Uninstalling Memory Profiler
--------------------

Just run "python manage.py uninstall", optionally specifying a profile
name if necessary, just like you did with the 'install' target.
Alternatively, you can also uninstall the extension through the normal
Firefox addon management UI.

Building an XPI
---------------

To build an XPI for Memory Profiler, just run:

  python manage.py xpi

More Information
----------------

More information on this project can be found here:

  https://wiki.mozilla.org/Labs/Memory_Profiler
