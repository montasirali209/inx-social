# OpenMontage integration notice

INXSocial communicates over authenticated HTTP with a separately deployed
OpenMontage worker. The worker installs and executes the unmodified OpenMontage
runtime pinned to commit `08e2151fa02de28a5d6a312b3d575692bf147ad7`.

OpenMontage is copyright its contributors and distributed under the GNU Affero General Public License v3.0. The upstream project and complete corresponding source are available at:

https://github.com/calesthio/OpenMontage

The corresponding worker source is available in `openmontage-worker/` in this
repository. OpenMontage itself remains a separate process and codebase; INXSocial
communicates with it through a standard authenticated REST interface and does not
import its Python modules into the application runtime. Pexels, Pixabay and other
media remain subject to their respective content licences and contributor rights;
every selected clip is recorded in the production provenance.
