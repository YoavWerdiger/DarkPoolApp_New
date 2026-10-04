Pod::Spec.new do |s|
  s.name           = 'ShareTargets'
  s.version        = '0.1.0'
  s.summary        = 'Chat groups as share sheet suggestions'
  s.license        = 'MIT'
  s.author         = 'DarkPool'
  s.homepage       = 'https://github.com/darkpoolapp'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Intents'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
