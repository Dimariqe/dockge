<template>
    <span v-if="needsUpdate" :class="className" :title="updateTooltip">
        <font-awesome-icon icon="exclamation-circle" />
        <span v-if="!fixedWidth">{{ $t("updateAvailable") }}</span>
    </span>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

export default {
    components: {
        FontAwesomeIcon
    },
    props: {
        stack: {
            type: Object,
            default: null,
        },
        fixedWidth: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            containersUpdateInfo: {},
            checkTimeout: null,
        };
    },
    computed: {
        needsUpdate() {
            return Object.values(this.containersUpdateInfo).some(info => info?.needsUpdate);
        },
        
        updateTooltip() {
            if (this.needsUpdate) {
                const outdatedContainers = Object.entries(this.containersUpdateInfo)
                    .filter(([_, info]) => info?.needsUpdate)
                    .map(([name, _]) => name);
                return `Updates available for: ${outdatedContainers.join(', ')}`;
            }
            return "";
        },

        className() {
            let className = "badge rounded-pill bg-warning text-dark";
            
            if (this.fixedWidth) {
                className += " fixed-width";
            }
            return className;
        },
    },
    mounted() {
        // Delay the check to avoid overwhelming the system on initial load
        this.checkTimeout = setTimeout(() => {
            this.checkStackUpdates();
        }, 2000);
    },
    beforeUnmount() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }
    },
    watch: {
        'stack.name'() {
            if (this.checkTimeout) {
                clearTimeout(this.checkTimeout);
            }
            this.checkTimeout = setTimeout(() => {
                this.checkStackUpdates();
            }, 1000);
        }
    },
    methods: {
        async checkStackUpdates() {
            if (!this.stack || !this.stack.name) {
                return;
            }
            
            // Get stack details to know which containers/services it has
            this.$root.emitAgent(this.stack.endpoint, "getStack", this.stack.name, (res) => {
                if (res.ok && res.stack) {
                    try {
                        // Get services from JSON config if available
                        let services = {};
                        
                        if (res.stack.composeYAML) {
                            const yamlContent = res.stack.composeYAML;
                            
                            // Improved YAML parsing
                            const lines = yamlContent.split('\n');
                            let currentService = null;
                            let inServicesSection = false;
                            
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                
                                // Check if we're in services section
                                if (line.trim() === 'services:') {
                                    inServicesSection = true;
                                    continue;
                                }
                                
                                // Stop if we hit another top-level section
                                if (inServicesSection && line.match(/^[a-zA-Z]/)) {
                                    if (!line.includes(':') || line.startsWith('services:')) {
                                        continue;
                                    } else {
                                        inServicesSection = false;
                                    }
                                }
                                
                                if (inServicesSection) {
                                    // Match service name (indented with 2+ spaces, ends with colon)
                                    const serviceMatch = line.match(/^[ ]{2,4}([a-zA-Z0-9_-]+):\s*$/);
                                    if (serviceMatch) {
                                        currentService = serviceMatch[1];
                                        continue;
                                    }
                                    
                                    // Match image line (more indented than service)
                                    const imageMatch = line.match(/^[ ]{4,}image:\s*(.+)$/);
                                    if (imageMatch && currentService) {
                                        const imageName = imageMatch[1].trim().replace(/["']/g, '');
                                        services[currentService] = imageName;
                                    }
                                }
                            }
                        }
                        
                        // Check each service for updates
                        Object.entries(services).forEach(([serviceName, imageName]) => {
                            this.checkImageUpdate(serviceName, imageName);
                        });
                        
                    } catch (e) {
                        console.error("Error parsing stack for updates:", e);
                    }
                }
            });
        },
        
        async checkImageUpdate(serviceName, imageName) {
            if (!imageName) return;
            
            // Get local image info
            this.$root.emitAgent(this.stack.endpoint, "getImageInfo", imageName, (localRes) => {
                if (localRes.ok && localRes.imageInfo) {
                    // Get remote image info
                    this.$root.emitAgent(this.stack.endpoint, "getRemoteImageInfo", imageName, (remoteRes) => {
                        if (remoteRes.ok && remoteRes.remoteImageInfo) {
                            const localDigest = this.extractDigest(localRes.imageInfo);
                            const remoteDigest = remoteRes.remoteImageInfo.digest;
                            
                            const needsUpdate = localDigest && remoteDigest && localDigest !== remoteDigest;
                            
                            this.containersUpdateInfo = {
                                ...this.containersUpdateInfo,
                                [serviceName]: {
                                    needsUpdate: needsUpdate,
                                    localDigest,
                                    remoteDigest,
                                    imageName
                                }
                            };
                        }
                    });
                }
            });
        },
        
        extractDigest(imageInfo) {
            if (imageInfo && imageInfo.RepoDigests && imageInfo.RepoDigests.length > 0) {
                return imageInfo.RepoDigests[0].split('@')[1];
            }
            return null;
        }
    }
};
</script>

<style scoped>
.badge {
    min-width: 62px;
    font-size: 0.7rem;
}

.fixed-width {
    width: 30px;
    min-width: 30px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
}
</style>
